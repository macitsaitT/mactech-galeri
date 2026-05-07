from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from db import db
from auth import get_current_user
from models import CarCreate, Car
from helpers import build_data_filter, log_activity

router = APIRouter()


@router.get("/cars", response_model=List[Car])
async def get_cars(created_by: str = None, branch_id: str = None, current_user: dict = Depends(get_current_user)):
    extra = {}
    if created_by:
        extra["created_by"] = created_by
    if branch_id:
        extra["branch_id"] = branch_id
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
    await log_activity(
        db, current_user=current_user, action="create", entity_type="car",
        entity_id=car_id, entity_label=car_doc.get("plate", "").upper(),
        details={"brand": car_doc.get("brand"), "model": car_doc.get("model"),
                 "purchase_price": car_doc.get("purchase_price"),
                 "sale_price": car_doc.get("sale_price")},
    )
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
        # ✅ Satış iptal — müşterinin "Satış Yapıldı" type'ını geri al (eğer bu müşterinin
        # BAŞKA aktif satışı yoksa)
        sold_customer_id = existing.get("customer_id") or existing.get("sold_customer_id")
        if sold_customer_id:
            # Bu müşterinin hâlâ Satıldı durumundaki başka araçları var mı?
            other_sold = await db.cars.count_documents({
                "org_id": org_id,
                "customer_id": sold_customer_id,
                "status": "Satıldı",
                "deleted": {"$ne": True},
                "id": {"$ne": car_id},
            })
            if other_sold == 0:
                await db.customers.update_one(
                    {"id": sold_customer_id, "org_id": org_id},
                    {"$set": {"type": "Potansiyel"}},
                )
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cars.update_one({"id": car_id}, {"$set": updates})

    # ✅ Fiyat ve durum değişikliklerini activity log'a yaz
    plate = (existing.get("plate") or "").upper()
    tracked_fields = ("purchase_price", "sale_price", "status", "employee_share")
    for fld in tracked_fields:
        if fld in updates:
            old_v = existing.get(fld)
            new_v = updates.get(fld)
            if old_v != new_v:
                action = "price_change" if fld in ("purchase_price", "sale_price") else \
                         "status_change" if fld == "status" else "update"
                label_map = {
                    "purchase_price": "Alış Fiyatı",
                    "sale_price": "Satış Fiyatı",
                    "status": "Durum",
                    "employee_share": "Çalışan Payı",
                }
                await log_activity(
                    db, current_user=current_user, action=action, entity_type="car",
                    entity_id=car_id, entity_label=plate,
                    details={"field": fld, "field_label": label_map[fld], "old": old_v, "new": new_v},
                )

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

    # ✅ Cascade: bu araca bağlı AKTİF transaction'ların kasa etkisini geri al,
    # sonra hem tx'leri hem de kasa hareketlerini sil. Böylece "bir yerden silince ilgili her şey silinir".
    from capital_service import apply_delta
    from routes.transactions import _tx_delta

    related_txs = await db.transactions.find(
        {"car_id": car_id, "org_id": org_id, "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(10000)

    for tx in related_txs:
        if tx.get("capital_applied"):
            reverse_delta = -_tx_delta(tx)
            if reverse_delta != 0:
                await apply_delta(
                    org_id, reverse_delta,
                    reason="cascade_delete_car",
                    ref_type="transaction", ref_id=tx["id"],
                    description=f"Araç silindi: {existing.get('plate', '')} - {tx.get('category', '')}",
                    allow_negative=True,
                    user_id=current_user.get("user_id"),
                )

    if permanent:
        # Tam temizlik: cars + transactions + capital_movements
        await db.cars.delete_one({"id": car_id})
        tx_ids = [t["id"] for t in related_txs]
        if tx_ids:
            await db.capital_movements.delete_many({"org_id": org_id, "ref_id": {"$in": tx_ids}})
            await db.transactions.delete_many({"car_id": car_id, "org_id": org_id})
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.cars.update_one({"id": car_id}, {"$set": {"deleted": True, "deleted_at": now}})
        # Soft-delete transaction'lar (kasa zaten yukarıda revert edildi)
        await db.transactions.update_many(
            {"car_id": car_id, "org_id": org_id},
            {"$set": {"deleted": True, "deleted_at": now, "capital_applied": False}},
        )

    await log_activity(
        db, current_user=current_user,
        action="permanent_delete" if permanent else "delete",
        entity_type="car",
        entity_id=existing.get("id", ""),
        entity_label=(existing.get("plate") or "").upper(),
        details={"brand": existing.get("brand"), "model": existing.get("model")},
    )
    return {"success": True, "removed_transactions": len(related_txs)}


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
