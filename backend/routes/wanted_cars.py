"""Talep Eşleştirme — Aranan Araçlar (Wanted Cars).

Müşteriler stokta olmayan araçlar için kriter kaydeder.
Yeni araç eklendiğinde / fiyat güncellendiğinde eşleşen kayıtlar bildirilir.
"""
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from helpers import build_data_filter, log_activity

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WantedCarCreate(BaseModel):
    customer_id: str
    brand: str = ""
    model: str = ""
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    fuel_type: str = ""
    gear: str = ""
    notes: str = ""


class WantedCarUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    fuel_type: Optional[str] = None
    gear: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(active|matched|fulfilled|cancelled)$")


def _car_matches_request(car: dict, req: dict) -> bool:
    """Bir aracın aranan araç kriterlerine uyup uymadığını kontrol et."""
    if car.get("deleted") or car.get("status") == "Satıldı":
        return False

    def _iin(a: str, b: str) -> bool:
        return bool(a) and a.strip().lower() in (b or "").strip().lower()

    if req.get("brand") and not _iin(req["brand"], car.get("brand", "")):
        return False
    if req.get("model") and not _iin(req["model"], car.get("model", "")):
        return False
    try:
        car_year = int(car.get("year") or 0)
    except Exception:
        car_year = 0
    if req.get("year_min") and car_year and car_year < int(req["year_min"]):
        return False
    if req.get("year_max") and car_year and car_year > int(req["year_max"]):
        return False
    try:
        price = float(car.get("sale_price") or 0)
    except Exception:
        price = 0
    if req.get("budget_min") and price and price < float(req["budget_min"]):
        return False
    if req.get("budget_max") and price and price > float(req["budget_max"]):
        return False
    if req.get("fuel_type") and req["fuel_type"] != car.get("fuel_type"):
        return False
    if req.get("gear") and req["gear"] != car.get("gear"):
        return False
    return True


@router.post("/wanted-cars")
async def create_wanted(body: WantedCarCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    customer = await db.customers.find_one({"id": body.customer_id, "org_id": org_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": current_user["user_id"],
        "created_by": current_user["user_id"],
        "customer_name": customer.get("name", ""),
        "customer_phone": customer.get("phone", ""),
        "status": "active",
        "deleted": False,
        "created_at": _now(),
        "updated_at": _now(),
    })
    await db.wanted_cars.insert_one(doc.copy())
    await log_activity(
        db, current_user=current_user, action="create", entity_type="wanted_car",
        entity_id=doc["id"], entity_label=f"{doc.get('brand','')} {doc.get('model','')}".strip() or customer.get("name", ""),
        details={"customer_id": body.customer_id},
    )
    # ✅ Hemen mevcut stok ile eşleşme kontrolü yap
    match_count = await _count_matches_for_request(org_id, doc)
    doc["match_count"] = match_count
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/wanted-cars")
async def list_wanted(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("org_id", current_user["user_id"])
    extra = {"deleted": {"$ne": True}}
    if customer_id:
        extra["customer_id"] = customer_id
    if status:
        extra["status"] = status
    query = build_data_filter(current_user, extra)
    items = await db.wanted_cars.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Her kayıt için eşleşme sayısı ekle
    for it in items:
        it["match_count"] = await _count_matches_for_request(org_id, it)
    return items


@router.put("/wanted-cars/{wid}")
async def update_wanted(wid: str, body: WantedCarUpdate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.wanted_cars.find_one({"id": wid, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    await db.wanted_cars.update_one({"id": wid}, {"$set": updates})
    doc = await db.wanted_cars.find_one({"id": wid}, {"_id": 0})
    doc["match_count"] = await _count_matches_for_request(org_id, doc)
    return doc


@router.delete("/wanted-cars/{wid}")
async def delete_wanted(wid: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.wanted_cars.find_one({"id": wid, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    await db.wanted_cars.update_one({"id": wid}, {"$set": {"deleted": True, "deleted_at": _now()}})
    return {"success": True}


@router.get("/wanted-cars/{wid}/matches")
async def list_matches(wid: str, current_user: dict = Depends(get_current_user)):
    """Bu talep için eşleşen aktif stoktaki araçları döndür."""
    org_id = current_user.get("org_id", current_user["user_id"])
    req = await db.wanted_cars.find_one({"id": wid, "org_id": org_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    cars = await db.cars.find(
        {"org_id": org_id, "deleted": {"$ne": True}, "status": {"$ne": "Satıldı"}}, {"_id": 0}
    ).to_list(5000)
    matches = [c for c in cars if _car_matches_request(c, req)]
    return {"wanted_car": req, "matches": matches, "count": len(matches)}


@router.get("/wanted-cars/matches-for-car/{car_id}")
async def matches_for_car(car_id: str, current_user: dict = Depends(get_current_user)):
    """Bu araçla eşleşen tüm aktif talepleri döndür (yeni araç eklendiğinde kullanılır)."""
    org_id = current_user.get("org_id", current_user["user_id"])
    car = await db.cars.find_one({"id": car_id, "org_id": org_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    reqs = await db.wanted_cars.find(
        {"org_id": org_id, "deleted": {"$ne": True}, "status": "active"}, {"_id": 0}
    ).to_list(5000)
    matches = [r for r in reqs if _car_matches_request(car, r)]
    return {"car": car, "matching_requests": matches, "count": len(matches)}


async def _count_matches_for_request(org_id: str, req: dict) -> int:
    cars = await db.cars.find(
        {"org_id": org_id, "deleted": {"$ne": True}, "status": {"$ne": "Satıldı"}}, {"_id": 0}
    ).to_list(5000)
    return sum(1 for c in cars if _car_matches_request(c, req))
