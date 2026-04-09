from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, timezone
from typing import Optional
import secrets

from db import db

router = APIRouter()

# Webhook secret - Production'da env variable olarak saklanmalı
WEBHOOK_SECRET = "whsec_galeri_" + secrets.token_urlsafe(32)

# Webhook secret'i logla (ilk kurulumda görmek için)
print(f"🔐 Webhook Secret: {WEBHOOK_SECRET}")
print(f"📝 Bu secret'i mactech.tr webhook ayarlarına ekleyin")


async def verify_webhook_signature(authorization: str):
    """Webhook güvenlik kontrolü"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    if token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@router.post("/webhooks/app-access")
async def handle_app_access_webhook(
    payload: dict,
    authorization: str = Header(None)
):
    """
    MACTech websitesinden gelen webhook'ları işler
    
    Events:
    - trial.started: Kullanıcı 14 günlük deneme başlattı
    - subscription.created: Pro plan satın aldı
    - subscription.payment_success: Aylık ödeme başarılı
    - subscription.payment_failed: Aylık ödeme başarısız
    - subscription.cancelled: Pro plan iptal edildi
    """
    
    # Webhook güvenlik kontrolü
    await verify_webhook_signature(authorization)
    
    event = payload.get("event")
    mactech_id = payload.get("mactech_id")
    email = payload.get("email")
    app = payload.get("app")
    
    # Sadece galeri uygulaması için işle
    if app != "galeri":
        return {"status": "ignored", "reason": "Not galeri app"}
    
    if not mactech_id or not email:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Kullanıcıyı bul veya oluştur
    user = await db.users.find_one({"mactech_id": mactech_id}, {"_id": 0})
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Event'e göre işlem yap
    if event == "trial.started":
        return await handle_trial_started(user, payload, now)
    
    elif event == "subscription.created":
        return await handle_subscription_created(user, payload, now)
    
    elif event == "subscription.payment_success":
        return await handle_payment_success(user, payload, now)
    
    elif event == "subscription.payment_failed":
        return await handle_payment_failed(user, payload, now)
    
    elif event == "subscription.cancelled":
        return await handle_subscription_cancelled(user, payload, now)
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown event: {event}")


async def handle_trial_started(user: dict, payload: dict, now: str):
    """14 günlük deneme başlatıldı"""
    
    mactech_id = payload["mactech_id"]
    email = payload["email"]
    full_name = payload.get("full_name", "")
    phone = payload.get("phone", "")
    trial_start = payload.get("trial_start", now)
    trial_end = payload.get("trial_end")
    
    if user:
        # Mevcut kullanıcı - trial bilgilerini güncelle
        await db.users.update_one(
            {"mactech_id": mactech_id},
            {"$set": {
                "trial_active": True,
                "trial_start": trial_start,
                "trial_end": trial_end,
                "access_blocked": False,
                "updated_at": now
            }}
        )
        return {"status": "success", "action": "trial_updated", "mactech_id": mactech_id}
    
    else:
        # Yeni kullanıcı - oluştur
        import uuid
        user_id = str(uuid.uuid4())
        
        user_doc = {
            "id": user_id,
            "mactech_id": mactech_id,
            "email": email.lower().strip(),
            "password_hash": None,  # SSO kullanıcısı, şifre yok
            "company_name": full_name or "MACTech Kullanıcısı",
            "phone": phone,
            "address": "",
            "logo_url": "",
            "theme": "dark",
            "role": "admin",
            "org_id": user_id,
            "email_verified": True,
            "auth_provider": "sso",
            # Subscription bilgileri
            "subscription": "free",
            "payment_status": "trial",
            "trial_active": True,
            "trial_start": trial_start,
            "trial_end": trial_end,
            "access_blocked": False,
            # Timestamps
            "created_at": now,
            "updated_at": now
        }
        
        await db.users.insert_one(user_doc)
        
        # Default permissions oluştur
        from routes.users import DEFAULT_PERMISSIONS
        await db.permissions.insert_one({
            "org_id": user_id,
            "permissions": DEFAULT_PERMISSIONS,
            "created_at": now
        })
        
        return {"status": "success", "action": "user_created", "user_id": user_id, "mactech_id": mactech_id}


async def handle_subscription_created(user: dict, payload: dict, now: str):
    """Pro plan satın alındı (Aylık veya Yıllık)"""
    
    mactech_id = payload["mactech_id"]
    started_at = payload.get("started_at", now)
    payment_frequency = payload.get("payment_frequency", "monthly")  # monthly | yearly
    subscription_end_date = payload.get("subscription_end_date")  # Yıllık için bitiş tarihi
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {
        "subscription": "pro",
        "payment_status": "active",
        "payment_frequency": payment_frequency,
        "trial_active": False,
        "access_blocked": False,
        "subscription_started_at": started_at,
        "last_payment": now,
        "updated_at": now
    }
    
    # Yıllık abonelik ise bitiş tarihini kaydet
    if subscription_end_date:
        update_data["subscription_end_date"] = subscription_end_date
    
    await db.users.update_one(
        {"mactech_id": mactech_id},
        {"$set": update_data}
    )
    
    return {
        "status": "success",
        "action": "subscription_activated",
        "payment_frequency": payment_frequency,
        "mactech_id": mactech_id
    }


async def handle_payment_success(user: dict, payload: dict, now: str):
    """Aylık ödeme başarılı"""
    
    mactech_id = payload["mactech_id"]
    next_payment_due = payload.get("next_payment_due")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {
        "payment_status": "active",
        "access_blocked": False,
        "last_payment": now,
        "updated_at": now
    }
    
    if next_payment_due:
        update_data["next_payment_due"] = next_payment_due
    
    await db.users.update_one(
        {"mactech_id": mactech_id},
        {"$set": update_data}
    )
    
    return {"status": "success", "action": "payment_processed", "mactech_id": mactech_id}


async def handle_payment_failed(user: dict, payload: dict, now: str):
    """Aylık ödeme başarısız - ERİŞİM ENGELLE"""
    
    mactech_id = payload["mactech_id"]
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Erişimi engelle ama veriyi silme
    await db.users.update_one(
        {"mactech_id": mactech_id},
        {"$set": {
            "payment_status": "past_due",
            "access_blocked": True,
            "access_blocked_reason": "payment_failed",
            "access_blocked_at": now,
            "updated_at": now
        }}
    )
    
    return {"status": "success", "action": "access_blocked", "reason": "payment_failed", "mactech_id": mactech_id}


async def handle_subscription_cancelled(user: dict, payload: dict, now: str):
    """Pro plan iptal edildi - ERİŞİM ENGELLE"""
    
    mactech_id = payload["mactech_id"]
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Erişimi engelle ama veriyi silme
    await db.users.update_one(
        {"mactech_id": mactech_id},
        {"$set": {
            "subscription": "free",
            "payment_status": "cancelled",
            "access_blocked": True,
            "access_blocked_reason": "subscription_cancelled",
            "access_blocked_at": now,
            "updated_at": now
        }}
    )
    
    return {"status": "success", "action": "access_blocked", "reason": "subscription_cancelled", "mactech_id": mactech_id}


@router.get("/webhooks/secret")
async def get_webhook_secret():
    """Webhook secret'i döndür (sadece development için)"""
    return {"webhook_secret": WEBHOOK_SECRET}
