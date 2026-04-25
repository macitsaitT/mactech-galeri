"""
Vadeli Satış / Borç Takibi
- `installments` koleksiyonu: vadeli satış kayıtları
- Ödemeler `transactions` koleksiyonunda category='Taksit Ödemesi', installment_id ile bağlı
  → Kasa otomatik senkronize olur (her ödeme bir income transaction'ı)
- PDF üretimi frontend'de (jsPDF) yapılır.
"""
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from helpers import build_data_filter

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InstallmentCreate(BaseModel):
    customer_id: str
    car_id: Optional[str] = None
    total_amount: float = Field(..., gt=0)
    down_payment: float = Field(0, ge=0)  # Peşinat (ayrı transaction olarak tutulur)
    term_count: int = Field(1, ge=1, le=120)  # Toplam taksit sayısı
    start_date: str  # İlk taksit tarihi (YYYY-MM-DD)
    description: Optional[str] = ""


class InstallmentUpdate(BaseModel):
    total_amount: Optional[float] = None
    term_count: Optional[int] = None
    start_date: Optional[str] = None
    description: Optional[str] = None


@router.post("/installments")
async def create_installment(body: InstallmentCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    customer = await db.customers.find_one({"id": body.customer_id, "org_id": org_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    inst_id = str(uuid.uuid4())
    doc = {
        "id": inst_id,
        "org_id": org_id,
        "user_id": current_user["user_id"],
        "created_by": current_user["user_id"],
        "customer_id": body.customer_id,
        "customer_name": customer.get("name", ""),
        "car_id": body.car_id,
        "total_amount": float(body.total_amount),
        "down_payment": float(body.down_payment or 0),
        "term_count": int(body.term_count),
        "start_date": body.start_date,
        "description": body.description or "",
        "status": "active",  # active | completed | cancelled
        "deleted": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.installments.insert_one(doc.copy())
    return await _enrich(inst_id, org_id)


@router.get("/installments")
async def list_installments(
    customer_id: Optional[str] = None,
    car_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("org_id", current_user["user_id"])
    extra = {}
    if customer_id:
        extra["customer_id"] = customer_id
    if car_id:
        extra["car_id"] = car_id
    query = build_data_filter(current_user, extra)
    query["deleted"] = {"$ne": True}
    items = await db.installments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    enriched: List[dict] = []
    for item in items:
        enriched.append(await _enrich(item["id"], org_id, base=item))
    return enriched


@router.get("/installments/{installment_id}")
async def get_installment(installment_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    return await _enrich(installment_id, org_id)


@router.put("/installments/{installment_id}")
async def update_installment(installment_id: str, body: InstallmentUpdate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.installments.find_one({"id": installment_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vadeli satış bulunamadı")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    await db.installments.update_one({"id": installment_id}, {"$set": updates})
    return await _enrich(installment_id, org_id)


@router.delete("/installments/{installment_id}")
async def delete_installment(installment_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.installments.find_one({"id": installment_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vadeli satış bulunamadı")
    await db.installments.update_one(
        {"id": installment_id},
        {"$set": {"deleted": True, "deleted_at": _now()}},
    )
    return {"success": True}


async def _enrich(installment_id: str, org_id: str, base: Optional[dict] = None) -> dict:
    """Vadeli satış dokümanına ödemeleri ve özet bilgileri ekler."""
    inst = base or await db.installments.find_one({"id": installment_id, "org_id": org_id}, {"_id": 0})
    if not inst:
        raise HTTPException(status_code=404, detail="Vadeli satış bulunamadı")

    payments = await db.transactions.find(
        {
            "org_id": org_id,
            "installment_id": installment_id,
            "deleted": {"$ne": True},
        },
        {"_id": 0},
    ).sort("date", 1).to_list(500)

    paid = sum(float(p.get("amount", 0) or 0) for p in payments)
    total = float(inst.get("total_amount", 0) or 0)
    down = float(inst.get("down_payment", 0) or 0)
    remaining = max(0.0, total - down - paid)
    inst.update({
        "payments": payments,
        "paid_amount": paid,
        "down_payment_amount": down,
        "remaining_amount": remaining,
        "is_settled": remaining <= 0,
    })
    return inst
