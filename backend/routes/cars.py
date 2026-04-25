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

    # ✅ Muayene / Sigorta tarihi değiştiyse bildirimleri ve tetiklenmiş reminder'ları temizle
    inspection_fields = {
        "muayene_tarihi": "muayene",
        "inspection_date": "muayene",
        "sigorta_bitis_tarihi": "sigorta",
    }
    changed_types = set()
    for field, notif_type in inspection_fields.items():
        new_val = update_data.get(field)
        old_val = existing.get(field)
        if (new_val or old_val) and new_val != old_val:
            changed_types.add(notif_type)
    if changed_types:
        await db.notifications.delete_many({
            "org_id": org_id,
            "car_id": car_id,
            "notification_type": {"$in": list(changed_types)},
        })
        await db.reminders.update_many(
            {"org_id": org_id, "car_id": car_id, "reminder_type": {"$in": list(changed_types)}},
            {"$set": {"is_triggered": False}},
        )

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

    # ✅ employee_share değişirse ilgili "Çalışan Payı" expense transaction'ı da senkronize et
    if "employee_share" in updates:
        new_share = float(updates.get("employee_share", 0) or 0)
        old_share = float(existing.get("employee_share", 0) or 0)
        if new_share != old_share:
            tx = await db.transactions.find_one({
                "org_id": org_id,
                "car_id": car_id,
                "category": "Çalışan Payı",
                "deleted": {"$ne": True},
            })
            if tx:
                # Mevcut tx'i update_transaction üzerinden güncelle (capital sync için)
                from capital_service import apply_delta
                old_amount = float(tx.get("amount", 0) or 0)
                # capital delta = -(new - old)  çünkü expense → büyürse kasadan daha fazla düş
                cap_delta = -(new_share - old_amount)
                if cap_delta != 0 and tx.get("capital_applied"):
                    await apply_delta(
                        org_id, cap_delta,
                        reason="employee_share_sync",
                        ref_type="transaction", ref_id=tx["id"],
                        description="Çalışan payı güncellendi (araç senkron)",
                        allow_negative=True,
                        user_id=current_user["user_id"],
                    )
                await db.transactions.update_one(
                    {"id": tx["id"]},
                    {"$set": {"amount": new_share}},
                )
            elif new_share > 0:
                # Tx yoksa yeni "Çalışan Payı" expense oluştur (araç satılmışsa)
                if existing.get("status") == "Satıldı":
                    import uuid
                    tx_doc = {
                        "id": str(uuid.uuid4()),
                        "user_id": current_user["user_id"],
                        "org_id": org_id,
                        "created_by": current_user["user_id"],
                        "type": "expense",
                        "category": "Çalışan Payı",
                        "amount": new_share,
                        "date": existing.get("sold_date") or datetime.now(timezone.utc).date().isoformat(),
                        "description": f"Çalışan Payı - {existing.get('plate', '').upper()}",
                        "car_id": car_id,
                        "deleted": False,
                        "deleted_at": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "capital_applied": True,
                    }
                    from capital_service import apply_delta
                    await apply_delta(
                        org_id, -new_share,
                        reason="employee_share_create",
                        ref_type="transaction", ref_id=tx_doc["id"],
                        description=f"Çalışan payı eklendi: {existing.get('plate', '')}",
                        allow_negative=True,
                        user_id=current_user["user_id"],
                    )
                    await db.transactions.insert_one(tx_doc)

    # ✅ Muayene / Sigorta tarihi değişirse ilgili bekleyen bildirimleri ve tetiklenmiş
    # reminder'ları temizle → kullanıcı tarihi güncelleyince eski bildirim listesinde kalmaz.
    inspection_fields = {
        "muayene_tarihi": "muayene",
        "inspection_date": "muayene",
        "sigorta_bitis_tarihi": "sigorta",
    }
    changed_types = set()
    for field, notif_type in inspection_fields.items():
        if field in updates and updates.get(field) != existing.get(field):
            changed_types.add(notif_type)
    if changed_types:
        await db.notifications.delete_many({
            "org_id": org_id,
            "car_id": car_id,
            "notification_type": {"$in": list(changed_types)},
        })
        # Triggered reminder'ları sıfırla → yeni tarih için yeniden tetiklenebilsin
        await db.reminders.update_many(
            {"org_id": org_id, "car_id": car_id, "reminder_type": {"$in": list(changed_types)}},
            {"$set": {"is_triggered": False}},
        )

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
