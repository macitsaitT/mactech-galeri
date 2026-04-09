from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import CarCreate, Car
from helpers import build_data_filter

router = APIRouter()


@router.get("/cars", response_model=List[Car])
async def get_cars(created_by: str = None, current_user: dict = Depends(get_current_user)):
    extra = {"created_by": created_by} if created_by else {}
    query = build_data_filter(current_user, extra)
    return await db.cars.find(query, {"_id": 0}).to_list(1000)


@router.post("/cars", response_model=Car)
async def create_car(car: CarCreate, current_user: dict = Depends(get_current_user)):
    car_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    car_doc = car.model_dump()
    car_doc.update({
        "id": car_id, "user_id": current_user["user_id"],
        "org_id": current_user.get("org_id", current_user["user_id"]),
        "created_by": current_user["user_id"],
        "deleted": False, "deleted_at": None, "created_at": now, "updated_at": now
    })
    await db.cars.insert_one(car_doc)
    return await db.cars.find_one({"id": car_id}, {"_id": 0})


@router.put("/cars/{car_id}", response_model=Car)
async def update_car(car_id: str, car: CarCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.cars.find_one({"id": car_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Car not found")
    update_data = car.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cars.update_one({"id": car_id}, {"$set": update_data})
    return await db.cars.find_one({"id": car_id}, {"_id": 0})


@router.patch("/cars/{car_id}")
async def patch_car(car_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.cars.find_one({"id": car_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Car not found")
    if updates.get("status") == "Satıldı":
        user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
        if user:
            updates["sold_by_user_id"] = current_user["user_id"]
            updates["sold_by_name"] = user.get("company_name", user.get("email", ""))
    if updates.get("status") and updates["status"] != "Satıldı" and existing.get("status") == "Satıldı":
        updates["sold_by_user_id"] = ""
        updates["sold_by_name"] = ""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cars.update_one({"id": car_id}, {"$set": updates})
    return await db.cars.find_one({"id": car_id}, {"_id": 0})


@router.delete("/cars/{car_id}")
async def delete_car(car_id: str, permanent: bool = False, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.cars.find_one({"id": car_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Car not found")
    if permanent:
        await db.cars.delete_one({"id": car_id})
        await db.transactions.delete_many({"car_id": car_id, "org_id": org_id})
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.cars.update_one({"id": car_id}, {"$set": {"deleted": True, "deleted_at": now}})
        await db.transactions.update_many({"car_id": car_id, "org_id": org_id}, {"$set": {"deleted": True, "deleted_at": now}})
    return {"success": True}


@router.post("/cars/{car_id}/restore")
async def restore_car(car_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.cars.find_one({"id": car_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Car not found")
    await db.cars.update_one({"id": car_id}, {"$set": {"deleted": False, "deleted_at": None}})
    await db.transactions.update_many({"car_id": car_id, "org_id": org_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.cars.find_one({"id": car_id}, {"_id": 0})


@router.get("/inspection-due")
async def get_inspection_due_cars(current_user: dict = Depends(get_current_user)):
    """
    Muayene tarihi yaklaşan araçları getir
    Her aracın kendi notification_days değerine göre kontrol yapılır
    """
    from datetime import timedelta
    
    org_id = current_user.get("org_id", current_user["user_id"])
    
    # Tüm araçları getir (silinmemiş ve muayene tarihi olan)
    query = {
        "org_id": org_id,
        "deleted": False,
        "inspection_date": {"$exists": True, "$ne": ""}
    }
    
    cars = await db.cars.find(query, {"_id": 0}).to_list(1000)
    
    # Muayene tarihi yaklaşan araçları filtrele
    due_cars = []
    today = datetime.now(timezone.utc).date()
    
    for car in cars:
        try:
            inspection_date = datetime.fromisoformat(car["inspection_date"]).date()
            notification_days = car.get("inspection_notification_days", 30)
            
            # Kaç gün kaldı
            days_until = (inspection_date - today).days
            
            # Bildirim günü geldi mi veya geçti mi?
            if 0 <= days_until <= notification_days:
                car["days_until_inspection"] = days_until
                due_cars.append(car)
        except (ValueError, TypeError):
            # Geçersiz tarih formatı, atla
            continue
    
    # Tarihe göre sırala (en yakın önce)
    due_cars.sort(key=lambda x: x["days_until_inspection"])
    
    return due_cars
