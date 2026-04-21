from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import TransactionCreate, Transaction
from helpers import build_data_filter
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

    # ✅ Önce kasa atomik kontrol/güncelleme (expense ise yeterlilik koşulu)
    delta = _tx_delta(transaction_doc)
    await apply_delta(
        org_id,
        delta,
        reason="transaction_create",
        ref_type="transaction",
        ref_id=transaction_id,
        description=f"{transaction_doc.get('category', '')}: {transaction_doc.get('description', '')}",
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
            user_id=current_user["user_id"],
        )
        # ✅ Uygulandıysa flag ayarla
        updates["capital_applied"] = True

    await db.transactions.update_one({"id": transaction_id}, {"$set": updates})
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})

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
    else:
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
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
            user_id=current_user["user_id"],
        )

    await db.transactions.update_one({"id": transaction_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
