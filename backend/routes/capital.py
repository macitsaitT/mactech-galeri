"""Kasa / Sermaye endpoint'leri."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

from auth import get_current_user
from db import db
from capital_service import get_capital, apply_delta

router = APIRouter()


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
    org_id = current_user.get("org_id", current_user["user_id"])
    return await get_capital(org_id)


@router.post("/capital/adjust")
async def adjust_capital(body: CapitalAdjust, current_user: dict = Depends(get_current_user)):
    """Manuel kasa girişi (deposit) veya çıkışı (withdrawal)."""
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


@router.get("/capital/movements")
async def list_movements(limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Son kasa hareketleri (denetim)."""
    org_id = current_user.get("org_id", current_user["user_id"])
    movements = (
        await db.capital_movements.find({"org_id": org_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(max(1, min(limit, 500)))
    )
    return {"movements": movements}


# Yalnızca manuel kasa hareketleri silinebilir (transaction'lardan üretilenler değil)
_DELETABLE_REASONS = {
    "manual_deposit",
    "manual_withdrawal",
    "manual_set",
    "capital_initialize",
}


@router.delete("/capital/movements/{movement_id}")
async def delete_movement(movement_id: str, current_user: dict = Depends(get_current_user)):
    """
    Manuel kasa hareketini sil ve etkisini kasadan geri al.
    Yalnızca `_DELETABLE_REASONS` içindeki manuel hareketler silinebilir;
    transaction-bağlı hareketler (transaction_create vb.) ilgili işlem üzerinden yönetilir.
    """
    org_id = current_user.get("org_id", current_user["user_id"])
    mv = await db.capital_movements.find_one({"id": movement_id, "org_id": org_id}, {"_id": 0})
    if not mv:
        raise HTTPException(status_code=404, detail="Kasa hareketi bulunamadı")
    if mv.get("reason") not in _DELETABLE_REASONS:
        raise HTTPException(
            status_code=400,
            detail="Bu hareket transaction'a bağlıdır. İlgili gelir/gider işlemi üzerinden silinmelidir.",
        )

    # Etkiyi geri al (delta'yı tersine çevir)
    reverse_delta = -float(mv.get("delta", 0) or 0)
    if reverse_delta != 0:
        await apply_delta(
            org_id,
            reverse_delta,
            reason="manual_movement_delete",
            ref_type="capital_movement",
            ref_id=movement_id,
            description=f"Manuel hareket silindi: {mv.get('description', '')}",
            allow_negative=True,
            user_id=current_user.get("user_id"),
        )

    await db.capital_movements.delete_one({"id": movement_id, "org_id": org_id})
    return {"success": True}
