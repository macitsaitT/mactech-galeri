from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import TransactionCreate, Transaction
from helpers import build_data_filter, log_activity
from capital_service import apply_delta

router = APIRouter()


def _tx_delta(tx: dict) -> float:
    """Income → +amount, Expense → -amount"""
    amount = float(tx.get("amount", 0) or 0)
    return amount if tx.get("type") == "income" else -amount


@router.get("/transactions", response_model=List[Transaction])
async def get_transactions(created_by: str = None, current_user: dict = Depends(get_current_user)):
    extra = {"created_by": created_by} if created_by else {}
    query = build_data_filter(current_user, extra)
    return await db.transactions.find(query, {"_id": 0}).to_list(5000)


@router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    transaction_doc = transaction.model_dump()
    transaction_doc.update({
        "id": transaction_id, "user_id": current_user["user_id"],
        "org_id": org_id,
        "created_by": current_user["user_id"],
        "deleted": False, "deleted_at": None, "created_at": now,
        "capital_applied": True,  # ✅ Bu işlem kasa bakiyesini etkiler
    })

    # ✅ Önce kasa atomik kontrol/güncelleme
    # Not: allow_negative=True → kullanıcı kasayı negatife düşürse bile masraf/işlem
    # her halükârda kaydedilir. Aksi durumda araç masrafları (boya, bakım vb.)
    # kasada nakit yoksa kayda geçmiyordu. Kullanıcı dilerse "İlk Kurulum" ile senkronlar.
    delta = _tx_delta(transaction_doc)
    await apply_delta(
        org_id,
        delta,
        reason="transaction_create",
        ref_type="transaction",
        ref_id=transaction_id,
        description=f"{transaction_doc.get('category', '')}: {transaction_doc.get('description', '')}",
        allow_negative=True,
        user_id=current_user["user_id"],
    )

    # Capital OK → insert
    try:
        await db.transactions.insert_one(transaction_doc)
    except Exception:
        # Insert başarısız olursa kasa hareketini geri al
        await apply_delta(
            org_id, -delta,
            reason="transaction_create_rollback",
            ref_type="transaction", ref_id=transaction_id,
            description="Insert başarısız, kasa geri alındı",
            allow_negative=True, user_id=current_user["user_id"],
        )
        raise

    await log_activity(
        db, current_user=current_user, action="create", entity_type="transaction",
        entity_id=transaction_id, entity_label=transaction_doc.get("category", ""),
        details={
            "type": transaction_doc.get("type"),
            "amount": transaction_doc.get("amount"),
            "car_id": transaction_doc.get("car_id") or None,
            "customer_id": transaction_doc.get("customer_id") or None,
        },
    )
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})


@router.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # ✅ Kasa delta hesapla (eski değeri geri al, yeniyi uygula)
    old_delta = _tx_delta(existing) if existing.get("capital_applied") and not existing.get("deleted") else 0
    new_doc = {**existing, **updates}
    new_delta = _tx_delta(new_doc) if not new_doc.get("deleted") else 0
    net_delta = new_delta - old_delta
    if net_delta != 0:
        await apply_delta(
            org_id, net_delta,
            reason="transaction_update",
            ref_type="transaction", ref_id=transaction_id,
            description=f"Güncelleme: {new_doc.get('category', '')}",
            allow_negative=True,
            user_id=current_user["user_id"],
        )
        # ✅ Uygulandıysa flag ayarla
        updates["capital_applied"] = True

    await db.transactions.update_one({"id": transaction_id}, {"$set": updates})
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})

    # ✅ Activity log — önemli alanlar değiştiyse kaydet
    tracked = ("amount", "type", "category", "date", "description")
    changed_fields = {}
    for k in tracked:
        if k in updates and existing.get(k) != updates[k]:
            changed_fields[k] = {"old": existing.get(k), "new": updates[k]}
    if changed_fields:
        await log_activity(
            db, current_user=current_user, action="update", entity_type="transaction",
            entity_id=transaction_id, entity_label=updated.get("category", ""),
            details={"changes": changed_fields, "amount": updated.get("amount")},
        )

    # ✅ "Araç Satışı" income ise ilgili araç sale_price ve sold_date senkronize edilir
    try:
        is_sale_tx = (
            (updated.get("category") == "Araç Satışı")
            and updated.get("car_id")
            and updated.get("type") == "income"
        )
        if is_sale_tx:
            car = await db.cars.find_one({"id": updated["car_id"], "org_id": org_id})
            if car:
                deposit = car.get("deposit_amount", 0) or 0
                new_amount = updated.get("amount", 0) or 0
                car_updates = {
                    "sale_price": new_amount + deposit,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if updated.get("date"):
                    car_updates["sold_date"] = updated["date"]
                await db.cars.update_one({"id": updated["car_id"]}, {"$set": car_updates})
    except Exception:
        pass

    return updated


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, permanent: bool = False, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # ✅ Aktif ise (silinmemiş + capital uygulanmış) → kasa hareketini geri al
    was_active = existing.get("capital_applied") and not existing.get("deleted")
    if was_active:
        reverse_delta = -_tx_delta(existing)
        await apply_delta(
            org_id, reverse_delta,
            reason="transaction_delete",
            ref_type="transaction", ref_id=transaction_id,
            description=f"İşlem silindi: {existing.get('category', '')}",
            allow_negative=True,  # iptal ederken bakiye eksiye düşebilir
            user_id=current_user["user_id"],
        )

    if permanent:
        await db.transactions.delete_one({"id": transaction_id})
        # Permanent silmede tüm capital_movements de sil
        await db.capital_movements.delete_many({"org_id": org_id, "ref_id": transaction_id})
    else:
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat(), "capital_applied": False}},
        )
    await log_activity(
        db, current_user=current_user,
        action="permanent_delete" if permanent else "delete",
        entity_type="transaction",
        entity_id=transaction_id, entity_label=existing.get("category", ""),
        details={"amount": existing.get("amount"), "type": existing.get("type")},
    )
    return {"success": True}


@router.post("/transactions/{transaction_id}/restore")
async def restore_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # ✅ Restore edildiğinde kasa hareketini yeniden uygula
    if existing.get("capital_applied") and existing.get("deleted"):
        delta = _tx_delta(existing)
        await apply_delta(
            org_id, delta,
            reason="transaction_restore",
            ref_type="transaction", ref_id=transaction_id,
            description=f"İşlem geri yüklendi: {existing.get('category', '')}",
            allow_negative=True,
            user_id=current_user["user_id"],
        )

    await db.transactions.update_one({"id": transaction_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
