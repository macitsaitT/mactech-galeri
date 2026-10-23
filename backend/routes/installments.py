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



@router.get("/installments/overdue/list")
async def get_overdue_installments(current_user: dict = Depends(get_current_user)):
    """Vadesi geçen / yaklaşan alacaklar tablosu.

    Her vadeli satış için: beklenen ödenmiş taksit sayısı vs. gerçek,
    eksik taksit adedi, gecikmiş gün sayısı, kalan tutar.
    """
    from datetime import date as _date

    org_id = current_user.get("org_id", current_user["user_id"])
    items = await db.installments.find(
        {"org_id": org_id, "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(1000)

    today = _date.today()
    rows: List[dict] = []
    totals = {"overdue_count": 0, "overdue_amount": 0.0, "upcoming_count": 0, "total_remaining": 0.0}

    for inst in items:
        enriched = await _enrich(inst["id"], org_id, base=inst)
        if enriched.get("is_settled"):
            continue
        remaining = float(enriched.get("remaining_amount", 0) or 0)
        term_count = int(inst.get("term_count", 1) or 1)
        # Taksit tutarı (peşinat hariç, toplam / term_count)
        total = float(inst.get("total_amount", 0) or 0)
        down = float(inst.get("down_payment", 0) or 0)
        per_term = max(0.0, (total - down) / term_count) if term_count else 0

        start = inst.get("start_date") or ""
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d").date()
        except Exception:
            continue

        months_passed = max(0, (today.year - start_date.year) * 12 + (today.month - start_date.month) + (1 if today.day >= start_date.day else 0))
        expected_paid = min(term_count, months_passed) * per_term
        actual_paid = float(enriched.get("paid_amount", 0) or 0)
        overdue_amount = max(0.0, expected_paid - actual_paid)

        # Gecikmiş gün sayısı = expected'dan ne kadar geç
        days_overdue = 0
        if overdue_amount > 0 and per_term > 0:
            missed_terms = int(overdue_amount // per_term) + (1 if overdue_amount % per_term > 0.01 else 0)
            if missed_terms >= 1:
                # İlk eksik taksit tarihi
                first_missed_month = months_passed - missed_terms + 1
                try:
                    due_year = start_date.year + ((start_date.month - 1 + first_missed_month - 1) // 12)
                    due_month = ((start_date.month - 1 + first_missed_month - 1) % 12) + 1
                    due_day = min(start_date.day, 28)
                    due_date = _date(due_year, due_month, due_day)
                    days_overdue = max(0, (today - due_date).days)
                except Exception:
                    days_overdue = 0

        is_overdue = overdue_amount > 0
        rows.append({
            "installment_id": inst["id"],
            "customer_id": inst.get("customer_id"),
            "customer_name": inst.get("customer_name", ""),
            "car_id": inst.get("car_id"),
            "total_amount": total,
            "down_payment": down,
            "per_term_amount": round(per_term, 2),
            "term_count": term_count,
            "paid_amount": actual_paid,
            "expected_paid": round(expected_paid, 2),
            "overdue_amount": round(overdue_amount, 2),
            "remaining_amount": remaining,
            "days_overdue": days_overdue,
            "is_overdue": is_overdue,
            "start_date": start,
        })
        if is_overdue:
            totals["overdue_count"] += 1
            totals["overdue_amount"] += overdue_amount
        else:
            totals["upcoming_count"] += 1
        totals["total_remaining"] += remaining

    # Gecikmişleri öne al, sonra gecikme süresine göre azalan
    rows.sort(key=lambda r: (not r["is_overdue"], -r["days_overdue"], -r["overdue_amount"]))
    totals["overdue_amount"] = round(totals["overdue_amount"], 2)
    totals["total_remaining"] = round(totals["total_remaining"], 2)
    return {"rows": rows, "totals": totals}
