import os
from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, timezone
from typing import Optional
import secrets

from db import db

router = APIRouter()

# Webhook secret — production'da .env'den alınır. Eksikse rastgele üret (dev mode).
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET") or ("whsec_galeri_" + secrets.token_urlsafe(32))

# Setup bilgisi logla (development için kolaylık)
if not os.environ.get("WEBHOOK_SECRET"):
    print(f"WARNING: WEBHOOK_SECRET env var set edilmemiş. Geçici değer: {WEBHOOK_SECRET}")
    print("Production'da backend/.env dosyasına WEBHOOK_SECRET=... ekleyin.")


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
    
    # Webhook güvenlik kontrolü (şimdilik devre dışı - production'da açılmalı)
    # await verify_webhook_signature(authorization)
    
    event = payload.get("event")
    user_data = payload.get("user", {})
    mactech_id = user_data.get("mactech_id")
    email = user_data.get("email")
    
    # Sadece galeri uygulaması için işle (eski format uyumluluğu)
    app = payload.get("app")
    if app and app != "galeri":
        return {"status": "ignored", "reason": "Not galeri app"}
    
    if not mactech_id or not email:
        raise HTTPException(status_code=400, detail="Missing required fields: mactech_id or email")
    
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


@router.post("/webhooks/mactech")
async def handle_mactech_webhook(
    payload: dict,
    authorization: str = Header(None)
):
    """
    MacTech webhook endpoint (alias for /webhooks/app-access)
    MacTech admin panelinde yapılandırılmış URL için
    """
    return await handle_app_access_webhook(payload, authorization)


async def handle_trial_started(user: dict, payload: dict, now: str):
    """14 günlük deneme başlatıldı"""
    
    # Yeni payload formatı (user nested)
    user_data = payload.get("user", payload)  # Fallback eski format için
    galeri_access = payload.get("galeri_access", payload)
    
    mactech_id = user_data.get("mactech_id")
    email = user_data.get("email")
    full_name = user_data.get("full_name", "")
    phone = user_data.get("phone", "")
    
    trial_start = galeri_access.get("trial_start", now)
    trial_end = galeri_access.get("trial_end")
    
    if not mactech_id or not email:
        raise HTTPException(status_code=400, detail="Missing mactech_id or email in payload")
    
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
            "auth_provider": "mactech_sso",
            # Subscription bilgileri
            "subscription": "trial",
            "payment_status": galeri_access.get("payment_status", ""),
            "payment_frequency": galeri_access.get("payment_frequency", ""),
            "trial_active": True,
            "trial_start": trial_start,
            "trial_end": trial_end,
            "subscription_end_date": None,
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
    email = payload.get("email")
    started_at = payload.get("started_at", now)
    payment_frequency = payload.get("payment_frequency", "monthly")  # monthly | yearly
    subscription_end_date = payload.get("subscription_end_date")  # Yıllık için bitiş tarihi
    
    if not user:
        # Kullanıcı yoksa oluştur
        if not email:
            raise HTTPException(status_code=400, detail="Email required for new user")
        
        import uuid
        user_id = str(uuid.uuid4())
        
        user_doc = {
            "id": user_id,
            "mactech_id": mactech_id,
            "email": email.lower().strip(),
            "password_hash": None,  # SSO kullanıcısı
            "company_name": payload.get("full_name", "MACTech Kullanıcısı"),
            "phone": payload.get("phone", ""),
            "address": "",
            "logo_url": "",
            "theme": "dark",
            "role": "admin",
            "org_id": user_id,
            "email_verified": True,
            "auth_provider": "sso",
            # Subscription bilgileri
            "subscription": "pro",
            "payment_status": "active",
            "payment_frequency": payment_frequency,
            "trial_active": False,
            "access_blocked": False,
            "subscription_started_at": started_at,
            "last_payment": now,
            "created_at": now,
            "updated_at": now
        }
        
        if subscription_end_date:
            user_doc["subscription_end_date"] = subscription_end_date
        
        await db.users.insert_one(user_doc)
        
        # Default permissions oluştur
        from routes.users import DEFAULT_PERMISSIONS
        await db.permissions.insert_one({
            "org_id": user_id,
            "permissions": DEFAULT_PERMISSIONS,
            "created_at": now
        })
        
        return {
            "status": "success",
            "action": "user_created_with_pro",
            "payment_frequency": payment_frequency,
            "user_id": user_id,
            "mactech_id": mactech_id
        }
    
    # Mevcut kullanıcı - subscription güncelle
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


@router.get("/admin/users-hierarchy")
async def get_users_hierarchy(authorization: str = Header(None)):
    """mactech.tr admin panel için hiyerarşik kullanıcı listesi.

    Ana admin kullanıcıları + her birinin altındaki çalışanları (alt kullanıcılar) döner.

    Kullanım (mactech.tr admin panelinden):
        GET /api/admin/users-hierarchy
        Authorization: Bearer {WEBHOOK_SECRET}

    Yanıt:
    [
      {
        "id": "...",
        "mactech_id": "...",
        "email": "sahibi@galeri.com",
        "company_name": "ABC Galeri",
        "role": "admin",
        "subscription": "pro",
        "trial_active": false,
        "created_at": "2025-...",
        "employees": [
          {"id": "...", "email": "satisci@...", "company_name": "Ali", "role": "satis", "created_at": "..."},
          ...
        ],
        "employee_count": 3
      },
      ...
    ]
    """
    # Auth — webhook secret ile aynı
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required (Bearer <webhook_secret>)")
    token = authorization.replace("Bearer ", "").strip()
    if token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    # Tüm admin (ana) kullanıcıları getir
    admins = await db.users.find(
        {"role": "admin"},
        {"_id": 0, "password_hash": 0, "verification_code": 0}
    ).to_list(10000)

    # Tüm admin-olmayan kullanıcıları org_id bazında grupla
    employees = await db.users.find(
        {"role": {"$ne": "admin"}},
        {"_id": 0, "password_hash": 0, "verification_code": 0}
    ).to_list(10000)
    emp_by_org: dict = {}
    for e in employees:
        oid = e.get("org_id") or ""
        if not oid:
            continue
        emp_by_org.setdefault(oid, []).append({
            "id": e.get("id"),
            "email": e.get("email"),
            "company_name": e.get("company_name"),
            "phone": e.get("phone"),
            "role": e.get("role"),
            "auth_provider": e.get("auth_provider", "local"),
            "created_at": e.get("created_at"),
            "access_blocked": e.get("access_blocked", False),
        })

    # Her admin için altına çalışanları ekle
    hierarchy = []
    for a in admins:
        org_id = a.get("org_id") or a.get("id")
        emps = emp_by_org.get(org_id, [])
        # Çalışanları en yeni eklenen sona gelecek şekilde sırala
        emps.sort(key=lambda x: x.get("created_at") or "")
        hierarchy.append({
            "id": a.get("id"),
            "mactech_id": a.get("mactech_id"),
            "email": a.get("email"),
            "company_name": a.get("company_name"),
            "phone": a.get("phone"),
            "role": "admin",
            "subscription": a.get("subscription", "free"),
            "payment_status": a.get("payment_status"),
            "trial_active": a.get("trial_active", False),
            "trial_end": a.get("trial_end"),
            "access_blocked": a.get("access_blocked", False),
            "auth_provider": a.get("auth_provider", "local"),
            "created_at": a.get("created_at"),
            "employees": emps,
            "employee_count": len(emps),
        })

    # En yeni admin üstte
    hierarchy.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    return {
        "total_admins": len(hierarchy),
        "total_employees": sum(h["employee_count"] for h in hierarchy),
        "users": hierarchy,
    }


@router.get("/admin/organization/{mactech_id}/employees")
async def get_organization_employees(
    mactech_id: str,
    authorization: str = Header(None),
):
    """Belirli bir ana admin'in altındaki çalışan listesi (tek org scope).

    mactech.tr panelinde admin detay sayfası için kullanılabilir.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = authorization.replace("Bearer ", "").strip()
    if token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    admin = await db.users.find_one({"mactech_id": mactech_id}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin (mactech_id) bulunamadı")

    org_id = admin.get("org_id") or admin.get("id")
    employees = await db.users.find(
        {"org_id": org_id, "role": {"$ne": "admin"}},
        {"_id": 0, "password_hash": 0, "verification_code": 0}
    ).sort("created_at", -1).to_list(500)

    return {
        "admin": {
            "id": admin.get("id"),
            "mactech_id": admin.get("mactech_id"),
            "email": admin.get("email"),
            "company_name": admin.get("company_name"),
        },
        "employees": employees,
        "count": len(employees),
    }

