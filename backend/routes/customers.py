from fastapi import APIRouter, HTTPException, Depends, Body
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import CustomerCreate, Customer
from helpers import build_data_filter

router = APIRouter()


@router.get("/customers", response_model=List[Customer])
async def get_customers(created_by: str = None, current_user: dict = Depends(get_current_user)):
    extra = {"created_by": created_by} if created_by else {}
    query = build_data_filter(current_user, extra)
    return await db.customers.find(query, {"_id": 0}).to_list(1000)


@router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    customer_doc = customer.model_dump()
    customer_doc.update({
        "id": customer_id, "user_id": current_user["user_id"],
        "org_id": current_user.get("org_id", current_user["user_id"]),
        "created_by": current_user["user_id"],
        "deleted": False, "deleted_at": None, "created_at": now
    })
    await db.customers.insert_one(customer_doc)
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """
    Müşteri günceller. Partial update destekli — sadece gönderilen alanlar değişir.
    Frontend bazen sadece `{type: 'Satış Yapıldı'}` gönderir; tüm alanları zorunlu kılmak
    422 Field required hatası üretiyordu (eski sürümde bu hata satış akışını kırıyordu).
    """
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.customers.find_one({"id": customer_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Sadece izin verilen alanlar güncellenebilir
    allowed = {"name", "phone", "type", "tags", "notes", "interested_car_ids"}
    updates = {k: v for k, v in (payload or {}).items() if k in allowed}
    if not updates:
        return await db.customers.find_one({"id": customer_id}, {"_id": 0})

    await db.customers.update_one({"id": customer_id}, {"$set": updates})
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, permanent: bool = False, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.customers.find_one({"id": customer_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    if permanent:
        await db.customers.delete_one({"id": customer_id})
    else:
        await db.customers.update_one({"id": customer_id}, {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}


@router.post("/customers/{customer_id}/restore")
async def restore_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.customers.find_one({"id": customer_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.customers.update_one({"id": customer_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})
