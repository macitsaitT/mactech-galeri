"""Kasa / Sermaye endpoint'leri."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime, timezone

from auth import get_current_user
from db import db
from capital_service import get_capital, apply_delta

router = APIRouter()

# ✅ Sermaye/Kasa modülü: sadece admin ve muhasebe rolleri erişebilir.
# 'satis' rolü sermaye bilgilerini görmemeli.
_FINANCE_ROLES = {"admin", "owner", "muhasebe"}


def _require_finance_role(current_user: dict) -> None:
    role = (current_user.get("role") or "").lower()
    if role not in _FINANCE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Sermaye/Kasa bilgilerine sadece yönetici ve muhasebe rolleri erişebilir.",
        )


class CapitalAdjust(BaseModel):
    amount: float = Field(..., gt=0, description="Pozitif tutar")
    type: Literal["deposit", "withdrawal"]  # deposit=giriş, withdrawal=çıkış
    description: Optional[str] = ""


class CapitalSet(BaseModel):
    amount: float = Field(..., ge=0, description="Yeni bakiye (sıfır veya pozitif)")
    description: Optional[str] = ""


class CapitalInitialize(BaseModel):
    starting_amount: float = Field(..., ge=0, description="Başlangıç sermayesi")
    description: Optional[str] = ""


@router.get("/capital")
async def read_capital(current_user: dict = Depends(get_current_user)):
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    cap = await get_capital(org_id)

    # ✅ Stoktaki araçlara bağlı sermaye hesabı — kullanıcı finansal panoda görmek istiyor
    cars = await db.cars.find(
        {"org_id": org_id, "status": "Stokta", "deleted": {"$ne": True}},
        {"_id": 0, "purchase_price": 1, "ownership": 1, "plate": 1, "brand": 1, "model": 1, "year": 1, "id": 1},
    ).to_list(5000)
    # Sadece stock ownership'te sermaye bağlı (konsinye satıcının parası)
    stock_cars = [c for c in cars if (c.get("ownership") == "stock")]
    vehicles_capital = sum(float(c.get("purchase_price", 0) or 0) for c in stock_cars)

    # ✅ Kuruluş/Başlangıç Sermayesi — admin tarafından ayarlanan sabit baseline
    founding_doc = await db.org_settings.find_one(
        {"org_id": org_id}, {"_id": 0, "founding_capital": 1}
    )
    founding_capital = float((founding_doc or {}).get("founding_capital", 0) or 0)

    if isinstance(cap, dict):
        cap["vehicles_capital"] = round(vehicles_capital, 2)
        cap["vehicles_count"] = len(stock_cars)
        cap["total_equity"] = round(float(cap.get("amount", 0) or 0) + vehicles_capital, 2)
        cap["founding_capital"] = round(founding_capital, 2)
        cap["vehicles_breakdown"] = [
            {
                "car_id": c.get("id"),
                "plate": (c.get("plate") or "").upper(),
                "brand": c.get("brand", ""),
                "model": c.get("model", ""),
                "year": c.get("year"),
                "purchase_price": float(c.get("purchase_price", 0) or 0),
            }
            for c in stock_cars
        ]
    return cap


class FoundingCapitalSet(BaseModel):
    amount: float = Field(..., ge=0, description="Kuruluş / başlangıç sermayesi (sabit baseline)")


@router.put("/capital/founding")
async def set_founding_capital(body: FoundingCapitalSet, current_user: dict = Depends(get_current_user)):
    """Kuruluş sermayesini ayarla — Dashboard'daki 'Sermaye' tile'ı bu değeri gösterir.
    Bu değer hesaplama formülünde sabit baseline'dır:
        Araç Masraf = Toplam Sermaye − Kuruluş Sermayesi − Net Kâr
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    await db.org_settings.update_one(
        {"org_id": org_id},
        {"$set": {"founding_capital": float(body.amount), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "founding_capital": float(body.amount)}


@router.post("/capital/adjust")
async def adjust_capital(body: CapitalAdjust, current_user: dict = Depends(get_current_user)):
    """Manuel kasa girişi (deposit) veya çıkışı (withdrawal)."""
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    delta = body.amount if body.type == "deposit" else -body.amount
    reason = "manual_deposit" if body.type == "deposit" else "manual_withdrawal"
    updated = await apply_delta(
        org_id,
        delta,
        reason=reason,
        ref_type="manual",
        description=body.description,
        user_id=current_user.get("user_id"),
    )
    return updated


@router.post("/capital/set")
async def set_capital(body: CapitalSet, current_user: dict = Depends(get_current_user)):
    """Kasa bakiyesini doğrudan ayarla (başlangıç sermayesi için)."""
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    current = await get_capital(org_id)
    current_amt = float(current.get("amount", 0) or 0)
    delta = body.amount - current_amt
    updated = await apply_delta(
        org_id,
        delta,
        reason="manual_set",
        ref_type="manual",
        description=body.description or f"Kasa sıfırlama/ayarlama: ₺{body.amount:,.2f}",
        allow_negative=True,
        user_id=current_user.get("user_id"),
    )
    return updated


@router.post("/capital/initialize")
async def initialize_capital(body: CapitalInitialize, current_user: dict = Depends(get_current_user)):
    """
    İlk Kurulum / Geçmiş İşlemleri Uygula:
    - Kasaya henüz uygulanmamış (capital_applied != True) tüm aktif transaction'ları toplayıp
      net delta hesaplar (income +, expense -).
    - Hedef bakiye = starting_amount + net_delta. Yani kullanıcı başlangıç sermayesini girer,
      sistem geçmiş alış/satış/giderleri otomatik düşer/ekler.
    - Tüm bu tx'leri capital_applied=True işaretler ki sonradan tekrar uygulanmasın.
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])

    # Geçmiş, kasaya uygulanmamış aktif transactions
    cursor = db.transactions.find({
        "org_id": org_id,
        "deleted": {"$ne": True},
        "capital_applied": {"$ne": True},
    })
    tx_list = await cursor.to_list(50000)

    net_delta = 0.0
    for t in tx_list:
        amount = float(t.get("amount", 0) or 0)
        net_delta += amount if t.get("type") == "income" else -amount

    target = float(body.starting_amount) + net_delta

    current = await get_capital(org_id)
    current_amt = float(current.get("amount", 0) or 0)
    diff = target - current_amt

    if diff != 0:
        await apply_delta(
            org_id,
            diff,
            reason="capital_initialize",
            ref_type="manual",
            description=(
                body.description
                or f"İlk kurulum: başlangıç ₺{body.starting_amount:,.2f} + geçmiş net ₺{net_delta:,.2f}"
            ),
            allow_negative=True,
            user_id=current_user.get("user_id"),
        )

    # Tüm uygulanan tx'leri işaretle (yeni transactionlar zaten True ile geliyor)
    if tx_list:
        await db.transactions.update_many(
            {
                "org_id": org_id,
                "deleted": {"$ne": True},
                "capital_applied": {"$ne": True},
            },
            {"$set": {"capital_applied": True}},
        )

    final = await get_capital(org_id)
    return {
        **final,
        "applied_transactions": len(tx_list),
        "net_delta_from_history": net_delta,
        "starting_amount": body.starting_amount,
    }


# Silinmiş işlemlerden gelen / silme/temizleme amacıyla atılmış movement'lar
# raporlarda ve listelerde gösterilmemeli (kullanıcı "iz kalmasın" istiyor).
_HIDDEN_REASONS = {
    "transaction_delete",       # Bir tx silindiğinde bakiye revert hareketi
    "manual_movement_delete",   # Manuel hareket silinince yazılan revert hareketi
    "cleanup_revert",           # Tx-linked silmede yazılan revert hareketi
    "cascade_delete_car",       # Araç silindiğinde tx revert hareketi
}


@router.get("/capital/movements")
async def list_movements(
    limit: int = 100,
    include_hidden: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    Son kasa hareketleri.
    Varsayılan: silinmiş tx'lere bağlı VEYA silme-amaçlı hareketler GİZLENİR
    (kullanıcı "silinen işlem her yerden silinmeli" dedi).
    `include_hidden=true` ile denetim için tümü görüntülenebilir.
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    raw = (
        await db.capital_movements.find({"org_id": org_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(max(1, min(limit, 1000)))
    )
    if include_hidden:
        return {"movements": raw[:limit]}

    # 1) Silme/temizlik amaçlı reason'ları çıkar
    filtered = [m for m in raw if m.get("reason") not in _HIDDEN_REASONS]

    # 2) Eğer hareket bir transaction'a bağlıysa (ref_type=transaction) ve o tx
    #    soft-deleted veya hard-deleted ise — orijinal create hareketini de gizle.
    tx_ids = list({m.get("ref_id") for m in filtered if m.get("ref_type") == "transaction" and m.get("ref_id")})
    if tx_ids:
        existing_active = await db.transactions.find(
            {"id": {"$in": tx_ids}, "org_id": org_id, "deleted": {"$ne": True}},
            {"_id": 0, "id": 1},
        ).to_list(len(tx_ids))
        active_ids = {t["id"] for t in existing_active}
        filtered = [
            m for m in filtered
            if (m.get("ref_type") != "transaction") or (m.get("ref_id") in active_ids)
        ]

    return {"movements": filtered[:limit]}


# Manuel hareketler — sadece kendisi silinir, bakiye revert edilir
_MANUAL_REASONS = {
    "manual_deposit",
    "manual_withdrawal",
    "manual_set",
    "capital_initialize",
}

# Bir transaction'a bağlı hareketler — tüm ilişkili kayıtlar silinir
_TX_LINKED_REASONS = {
    "transaction_create",
    "transaction_update",
    "transaction_restore",
    "transaction_delete",
}


@router.delete("/capital/movements/{movement_id}")
async def delete_movement(movement_id: str, current_user: dict = Depends(get_current_user)):
    """
    Kasa hareketini ve etkisini tamamen temizler.

    - Manuel hareket: bakiye revert edilir + kayıt hard-delete.
    - Transaction-bağlı (`transaction_create/update/restore/delete`): ilgili tx'in AKTİF
      kasa etkisi varsa önce reverse edilir, sonra **transaction + tüm ilişkili
      capital_movements kayıtları HARD-delete** edilir → kasa görünümünden tüm iz kaybolur
      (eski yarım satışlar, iptal edilmiş satışlar dahil).
    - Diğer otomatik kayıtlar (employee_share_*, cleanup_revert, manual_movement_delete vb.)
      tek başına hard-delete edilir (bakiye revert edilmez — bunlar zaten net etkisi sıfır
      olan denetim/track kayıtlardır).
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    mv = await db.capital_movements.find_one({"id": movement_id, "org_id": org_id}, {"_id": 0})
    if not mv:
        raise HTTPException(status_code=404, detail="Kasa hareketi bulunamadı")

    reason = mv.get("reason", "")

    # 1) MANUEL — bakiye revert + sil
    if reason in _MANUAL_REASONS:
        reverse_delta = -float(mv.get("delta", 0) or 0)
        if reverse_delta != 0:
            await apply_delta(
                org_id, reverse_delta,
                reason="manual_movement_delete",
                ref_type="capital_movement", ref_id=movement_id,
                description=f"Manuel hareket silindi: {mv.get('description', '')}",
                allow_negative=True,
                user_id=current_user.get("user_id"),
            )
        await db.capital_movements.delete_one({"id": movement_id, "org_id": org_id})
        return {"success": True, "type": "manual"}

    # 2) TRANSACTION-LINKED — tx + tüm ilgili movement'ları temizle
    if reason in _TX_LINKED_REASONS:
        tx_id = mv.get("ref_id")
        removed_movements = 0
        tx_removed = False

        if tx_id:
            tx = await db.transactions.find_one({"id": tx_id, "org_id": org_id})
            if tx:
                # Aktif tx ise (silinmemiş + kasaya uygulanmış) → bakiyeyi geri al
                if tx.get("capital_applied") and not tx.get("deleted"):
                    from capital_service import apply_delta as _apply
                    from routes.transactions import _tx_delta
                    reverse_delta = -_tx_delta(tx)
                    if reverse_delta != 0:
                        await _apply(
                            org_id, reverse_delta,
                            reason="cleanup_revert",
                            ref_type="transaction", ref_id=tx_id,
                            description=f"Kasa görünümünden silindi: {tx.get('category', '')}",
                            allow_negative=True,
                            user_id=current_user.get("user_id"),
                        )
                # Transaction'ı tamamen sil (hard delete)
                res = await db.transactions.delete_one({"id": tx_id, "org_id": org_id})
                tx_removed = res.deleted_count > 0

            # Bu tx'e ait TÜM hareket kayıtlarını hard-delete
            del_res = await db.capital_movements.delete_many({"org_id": org_id, "ref_id": tx_id})
            removed_movements = del_res.deleted_count

        # Hareketin kendisini de sil (yetimse)
        await db.capital_movements.delete_one({"id": movement_id, "org_id": org_id})

        return {
            "success": True,
            "type": "tx_linked",
            "transaction_removed": tx_removed,
            "movements_removed": removed_movements,
        }

    # 3) DİĞER OTOMATİK KAYITLAR — sadece bu kaydı sil (bakiye revert edilmez)
    await db.capital_movements.delete_one({"id": movement_id, "org_id": org_id})
    return {"success": True, "type": "audit_cleanup"}


@router.post("/capital/movements/cleanup-deleted")
async def cleanup_deleted_transactions(current_user: dict = Depends(get_current_user)):
    """
    Soft-delete edilmiş tüm transaction'ları ve onlarla ilişkili tüm capital_movements
    kayıtlarını HARD-delete eder. Kasa görünümünden iptal edilmiş satışlar/yarım kalmış
    işlemlerin tüm izini temizler. Bakiye etkilenmez (bu kayıtların net etkisi zaten 0'dı).
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])
    deleted_txs = await db.transactions.find(
        {"org_id": org_id, "deleted": True}, {"id": 1}
    ).to_list(10000)
    tx_ids = [t["id"] for t in deleted_txs]

    movements_removed = 0
    if tx_ids:
        del_mv = await db.capital_movements.delete_many({"org_id": org_id, "ref_id": {"$in": tx_ids}})
        movements_removed = del_mv.deleted_count
        del_tx = await db.transactions.delete_many({"org_id": org_id, "id": {"$in": tx_ids}})
        return {
            "success": True,
            "transactions_removed": del_tx.deleted_count,
            "movements_removed": movements_removed,
        }
    return {"success": True, "transactions_removed": 0, "movements_removed": 0}
