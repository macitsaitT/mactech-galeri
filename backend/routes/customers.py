from fastapi import APIRouter, HTTPException, Depends, Body
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import CustomerCreate, Customer
from helpers import build_data_filter
from security import validate_phone

router = APIRouter()


@router.get("/customers", response_model=List[Customer])
async def get_customers(created_by: str = None, branch_id: str = None, current_user: dict = Depends(get_current_user)):
    extra = {}
    if created_by:
        extra["created_by"] = created_by
    if branch_id:
        extra["branch_id"] = branch_id
    query = build_data_filter(current_user, extra)
    return await db.customers.find(query, {"_id": 0}).to_list(1000)


@router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    customer_doc = customer.model_dump()
    # ✅ Telefon 11 hane zorunlu
    customer_doc["phone"] = validate_phone(customer_doc.get("phone", ""), required=True)
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

    # ✅ Telefon değişiyorsa 11 hane kontrolü
    if "phone" in updates:
        updates["phone"] = validate_phone(updates["phone"], required=True)

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


@router.get("/customers/{customer_id}/detail")
async def get_customer_detail(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Müşteri detayı: satın aldığı araçlar + ödeme geçmişi + aktif taksitler."""
    org_id = current_user.get("org_id", current_user["user_id"])
    customer = await db.customers.find_one(
        {"id": customer_id, "org_id": org_id}, {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    # Satın alınan araçlar (aktif satışlar — silinmemiş ve Satıldı durumunda)
    purchased_cars = await db.cars.find({
        "org_id": org_id,
        "customer_id": customer_id,
        "status": "Satıldı",
        "deleted": {"$ne": True},
    }, {"_id": 0}).sort("sold_date", -1).to_list(500)

    # İlgili tüm ödeme/gelir transaction'ları (bu müşteriye ait)
    transactions = await db.transactions.find({
        "org_id": org_id,
        "customer_id": customer_id,
        "deleted": {"$ne": True},
    }, {"_id": 0}).sort("date", -1).to_list(500)

    # Vadeli taksitler
    installments = await db.installments.find({
        "org_id": org_id,
        "customer_id": customer_id,
        "deleted": {"$ne": True},
    }, {"_id": 0}).to_list(50)

    # Her araç için ödeme özeti hesapla
    for car in purchased_cars:
        car_txs = [t for t in transactions if t.get("car_id") == car.get("id")]
        incomes = sum(float(t.get("amount", 0) or 0) for t in car_txs if t.get("type") == "income")
        sale_price = float(car.get("sale_price", 0) or 0)
        car["total_paid"] = round(incomes, 2)
        car["remaining"] = round(max(0, sale_price - incomes), 2)

    totals = {
        "total_purchases": len(purchased_cars),
        "total_spent": sum(float(c.get("sale_price", 0) or 0) for c in purchased_cars),
        "total_paid": sum(c["total_paid"] for c in purchased_cars),
        "total_remaining": sum(c["remaining"] for c in purchased_cars),
        "installment_count": len(installments),
    }

    return {
        "customer": customer,
        "purchased_cars": purchased_cars,
        "transactions": transactions,
        "installments": installments,
        "totals": totals,
    }
