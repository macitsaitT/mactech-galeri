from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
from db import get_database
from auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class ReminderCreate(BaseModel):
    car_id: str
    reminder_type: str  # 'muayene' or 'sigorta'
    remind_date: str  # ISO format date
    remind_time: str  # "HH:MM" format


class NotificationResponse(BaseModel):
    id: str
    org_id: str
    car_id: str
    car_plate: str
    car_brand: str
    car_model: str
    notification_type: str  # 'muayene' or 'sigorta'
    expire_date: str
    message: str
    is_read: bool
    created_at: str


@router.post("/reminders")
async def create_reminder(
    reminder: ReminderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Araç için özel hatırlatma oluştur"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    # Araç kontrolü
    car = await db.cars.find_one(
        {"id": reminder.car_id, "org_id": org_id, "deleted": {"$ne": True}},
        {"_id": 0}
    )
    if not car:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Hatırlatma kaydet
    reminder_doc = {
        "id": f"rem_{datetime.now(timezone.utc).timestamp()}",
        "org_id": org_id,
        "car_id": reminder.car_id,
        "reminder_type": reminder.reminder_type,
        "remind_date": reminder.remind_date,
        "remind_time": reminder.remind_time,
        "is_triggered": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reminders.insert_one(reminder_doc)
    return {"message": "Hatırlatma oluşturuldu", "reminder_id": reminder_doc["id"]}


@router.get("/reminders/{car_id}")
async def get_car_reminders(
    car_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Araç için tanımlı hatırlatmaları getir"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    reminders = await db.reminders.find(
        {"car_id": car_id, "org_id": org_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"reminders": reminders}


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Hatırlatma sil"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    result = await db.reminders.delete_one(
        {"id": reminder_id, "org_id": org_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hatırlatma bulunamadı")
    
    return {"message": "Hatırlatma silindi"}


@router.get("/")
async def get_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Kullanıcının bildirimlerini getir"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    query = {"org_id": org_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"notifications": notifications}


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Bildirimi okundu işaretle"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    result = await db.notifications.update_one(
        {"id": notification_id, "org_id": org_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    return {"message": "Bildirim okundu olarak işaretlendi"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Bildirimi listeden kaldır (hard delete)"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    result = await db.notifications.delete_one(
        {"id": notification_id, "org_id": org_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"message": "Bildirim silindi"}


@router.post("/check-and-create")
async def check_and_create_notifications(
    current_user: dict = Depends(get_current_user)
):
    """
    Tüm araçları kontrol et ve hatırlatma zamanı gelmiş olanlar için bildirim oluştur.
    Bu endpoint cron job veya manuel olarak çağrılabilir.
    """
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    current_time_str = now.strftime("%H:%M")
    
    # Tetiklenmemiş hatırlatmaları bul
    reminders = await db.reminders.find({
        "org_id": org_id,
        "is_triggered": False,
        "remind_date": {"$lte": today_str}
    }, {"_id": 0}).to_list(1000)
    
    created_count = 0
    
    for reminder in reminders:
        # Tarih ve saat kontrolü
        if reminder["remind_date"] < today_str or (
            reminder["remind_date"] == today_str and reminder["remind_time"] <= current_time_str
        ):
            # Araç bilgisini getir
            car = await db.cars.find_one(
                {"id": reminder["car_id"], "org_id": org_id},
                {"_id": 0, "id": 1, "plate": 1, "brand": 1, "model": 1, 
                 "muayene_tarihi": 1, "sigorta_bitis_tarihi": 1}
            )
            
            if not car:
                continue
            
            # Bitiş tarihini al
            expire_date = ""
            if reminder["reminder_type"] == "muayene":
                expire_date = car.get("muayene_tarihi", "")
            elif reminder["reminder_type"] == "sigorta":
                expire_date = car.get("sigorta_bitis_tarihi", "")
            
            if not expire_date:
                continue
            
            # Kalan gün hesapla
            try:
                expire_dt = datetime.fromisoformat(expire_date)
                days_left = (expire_dt.date() - now.date()).days
                days_text = f"{days_left} gün kala" if days_left > 0 else "Bugün sona eriyor"
            except ValueError:
                days_text = ""
            
            # Bildirim mesajı
            type_text = "Muayene" if reminder["reminder_type"] == "muayene" else "Sigorta"
            message = f"🚗 Araç: {car['plate']} - {car['brand']} {car['model']}\n⚠️ {type_text} Tarihi: {expire_date} ({days_text})"
            
            # Bildirim oluştur
            notification = {
                "id": f"notif_{now.timestamp()}_{reminder['id']}",
                "org_id": org_id,
                "car_id": car["id"],
                "car_plate": car["plate"],
                "car_brand": car["brand"],
                "car_model": car["model"],
                "notification_type": reminder["reminder_type"],
                "expire_date": expire_date,
                "message": message,
                "is_read": False,
                "created_at": now.isoformat()
            }
            
            await db.notifications.insert_one(notification)
            
            # Hatırlatmayı tetiklenmiş olarak işaretle
            await db.reminders.update_one(
                {"id": reminder["id"]},
                {"$set": {"is_triggered": True}}
            )
            
            created_count += 1
    
    return {
        "message": f"{created_count} bildirim oluşturuldu",
        "checked_reminders": len(reminders)
    }


@router.get("/generate-ics/{car_id}")
async def generate_calendar_event(
    car_id: str,
    event_type: str,  # 'muayene' or 'sigorta'
    current_user: dict = Depends(get_current_user)
):
    """Takvim hatırlatması için .ics dosyası oluştur"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    car = await db.cars.find_one(
        {"id": car_id, "org_id": org_id},
        {"_id": 0, "plate": 1, "brand": 1, "model": 1, 
         "muayene_tarihi": 1, "sigorta_bitis_tarihi": 1}
    )
    
    if not car:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Tarihi al
    event_date = ""
    if event_type == "muayene":
        event_date = car.get("muayene_tarihi", "")
    elif event_type == "sigorta":
        event_date = car.get("sigorta_bitis_tarihi", "")
    
    if not event_date:
        raise HTTPException(status_code=400, detail="Tarih bilgisi bulunamadı")
    
    # .ics içeriği oluştur
    try:
        event_dt = datetime.fromisoformat(event_date)
        event_title = f"{'Muayene' if event_type == 'muayene' else 'Sigorta'} - {car['plate']}"
        event_description = f"{car['brand']} {car['model']} - {'Muayene' if event_type == 'muayene' else 'Sigorta'} Bitiş Tarihi"
        
        # iCalendar formatı
        ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MACTech CRM//TR
BEGIN:VEVENT
UID:{car_id}-{event_type}-{event_date}@mactech.tr
DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}
DTSTART:{event_dt.strftime('%Y%m%d')}
SUMMARY:{event_title}
DESCRIPTION:{event_description}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Hatırlatma: {event_title}
END:VALARM
END:VEVENT
END:VCALENDAR"""
        
        return {
            "ics_content": ics_content,
            "filename": f"{car['plate']}_{event_type}_{event_date}.ics"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ICS oluşturma hatası: {str(e)}")
