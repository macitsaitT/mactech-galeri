from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import TransactionCreate, Transaction
from helpers import build_data_filter

router = APIRouter()


@router.get("/transactions", response_model=List[Transaction])
async def get_transactions(created_by: str = None, current_user: dict = Depends(get_current_user)):
    extra = {"created_by": created_by} if created_by else {}
    query = build_data_filter(current_user, extra)
    return await db.transactions.find(query, {"_id": 0}).to_list(5000)


@router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    transaction_doc = transaction.model_dump()
    transaction_doc.update({
        "id": transaction_id, "user_id": current_user["user_id"],
        "org_id": current_user.get("org_id", current_user["user_id"]),
        "created_by": current_user["user_id"],
        "deleted": False, "deleted_at": None, "created_at": now
    })
    await db.transactions.insert_one(transaction_doc)
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})


@router.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.transactions.update_one({"id": transaction_id}, {"$set": updates})
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})

    # ✅ Bu bir "Araç Satışı" gelir transaction'ı ise ilgili aracın sale_price'ı da senkronize edilir.
    # Böylece Dashboard, rapor, PromoCard gibi car.sale_price okuyan yerler güncel kalır.
    # Satış sırasında transactions.amount = sale_price - deposit_amount olarak kaydedilir,
    # dolayısıyla yeni sale_price = yeni amount + car.deposit_amount.
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
                new_sale_price = new_amount + deposit
                car_updates = {
                    "sale_price": new_sale_price,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                # Tarihi de senkronize et (satış tarihi transaction tarihinden gelir)
                if updated.get("date"):
                    car_updates["sold_date"] = updated["date"]
                await db.cars.update_one({"id": updated["car_id"]}, {"$set": car_updates})
    except Exception:
        # Senkronizasyon hatası transaction güncellemesini bozmamalı
        pass

    return updated


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, permanent: bool = False, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if permanent:
        await db.transactions.delete_one({"id": transaction_id})
    else:
        await db.transactions.update_one({"id": transaction_id}, {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}


@router.post("/transactions/{transaction_id}/restore")
async def restore_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.transactions.find_one({"id": transaction_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.transactions.update_one({"id": transaction_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
