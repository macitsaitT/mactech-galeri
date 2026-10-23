# MACTech Multi-Tenant SaaS - Subscription Middleware
# /backend/middleware/subscription_middleware.py

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import jwt
import uuid
import os
import logging

from db import db

logger = logging.getLogger(__name__)
security = HTTPBearer()

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# Sektör tanımları
VALID_SECTORS = ["gallery", "realestate", "logistics", "accounting"]

# Trial süresi (gün)
TRIAL_DAYS = 14


# ==================== CUSTOM EXCEPTIONS ====================

class PaymentRequiredError(HTTPException):
    """402 Payment Required - Abonelik gerekli"""
    def __init__(
        self,
        sector_id: str,
        status: str,
        trial_ended_at: Optional[str] = None,
        message: str = "Aboneliğiniz sona erdi. Verileriniz güvende, erişmek için paket yenileyin.",
        plans: list = None
    ):
        detail = {
            "error": "payment_required",
            "code": "SUBSCRIPTION_EXPIRED",
            "message": message,
            "sector_id": sector_id,
            "subscription_status": status,
            "trial_ended_at": trial_ended_at,
            "data_preserved": True,  # Veriler silinmedi
            "plans": plans or [],
            "action_required": "subscribe",
            "checkout_url": f"/subscribe/{sector_id}"
        }
        super().__init__(status_code=402, detail=detail)


class AccessDeniedError(HTTPException):
    """403 Forbidden - Erişim yok"""
    def __init__(self, message: str = "Bu kaynağa erişim izniniz yok."):
        super().__init__(status_code=403, detail={"error": "access_denied", "message": message})


# ==================== JWT TOKEN HELPERS ====================

def decode_token(token: str) -> Dict[str, Any]:
    """JWT token'ı decode et"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail={"error": "token_expired", "message": "Oturum süreniz doldu."})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Geçersiz oturum."})


def create_token(user_id: str, email: str, org_id: str = None, role: str = "viewer") -> str:
    """JWT token oluştur"""
    payload = {
        "user_id": user_id,
        "email": email,
        "org_id": org_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ==================== AUTH MIDDLEWARE ====================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Kullanıcı kimlik doğrulama middleware'i
    Her istekte JWT token kontrolü yapar
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Geçersiz token."})
    
    # Kullanıcıyı veritabanından kontrol et
    user = await db.users.find_one({"id": user_id, "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail={"error": "user_not_found", "message": "Kullanıcı bulunamadı."})
    
    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "org_id": payload.get("org_id"),
        "role": payload.get("role", "viewer")
    }


# ==================== ORGANIZATION MIDDLEWARE ====================

async def get_organization_context(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Organizasyon context middleware'i
    Header'dan veya query'den org_id alır ve erişim kontrolü yapar
    """
    # Org ID'yi al (header > query > token)
    org_id = (
        request.headers.get("X-Organization-ID") or
        request.headers.get("X-Org-ID") or
        request.query_params.get("org_id") or
        current_user.get("org_id")
    )
    
    if not org_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_org_id", "message": "Organizasyon ID gerekli. X-Organization-ID header'ı ekleyin."}
        )
    
    # Organizasyonu kontrol et
    organization = await db.organizations.find_one({"id": org_id, "is_active": True})
    if not organization:
        raise HTTPException(status_code=404, detail={"error": "org_not_found", "message": "Organizasyon bulunamadı."})
    
    # Kullanıcının bu organizasyona erişimi var mı?
    user_access = await db.user_sectors.find_one({
        "user_id": current_user["user_id"],
        "organization_id": org_id,
        "is_active": True
    })
    
    # Owner kontrolü
    is_owner = organization.get("owner_id") == current_user["user_id"]
    
    if not user_access and not is_owner:
        raise AccessDeniedError("Bu organizasyona erişim izniniz yok.")
    
    role = "owner" if is_owner else (user_access.get("role") if user_access else "viewer")
    
    return {
        **current_user,
        "org_id": org_id,
        "organization": organization,
        "role": role,
        "is_owner": is_owner
    }


# ==================== SECTOR & SUBSCRIPTION MIDDLEWARE ====================

def extract_sector_from_path(path: str) -> Optional[str]:
    """URL path'inden sektör ID'sini çıkar"""
    parts = path.strip("/").split("/")
    
    # /api/v1/{sector}/... formatını bul
    for i, part in enumerate(parts):
        if part == "v1" and i + 1 < len(parts):
            potential_sector = parts[i + 1]
            if potential_sector in VALID_SECTORS:
                return potential_sector
    
    return None


async def get_sector_plans(sector_id: str) -> list:
    """Sektör için mevcut planları getir"""
    plans = await db.plans.find({
        "sector_id": sector_id,
        "is_active": True
    }).sort("sort_order", 1).to_list(10)
    
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "type": p.get("type"),
            "price_monthly": p.get("price_monthly"),
            "price_yearly": p.get("price_yearly"),
            "features": p.get("features", {}),
            "is_popular": p.get("is_popular", False)
        }
        for p in plans
    ]


async def check_subscription_status(
    org_id: str,
    sector_id: str
) -> Tuple[bool, Dict[str, Any]]:
    """
    Abonelik durumunu kontrol et
    Returns: (has_access: bool, subscription_info: dict)
    """
    now = datetime.now(timezone.utc)
    
    # Mevcut aboneliği bul
    subscription = await db.subscriptions.find_one({
        "organization_id": org_id,
        "sector_id": sector_id
    })
    
    if not subscription:
        # Abonelik yok - ilk erişim
        return False, {"status": "none", "subscription": None}
    
    status = subscription.get("status")
    
    # Aktif abonelik
    if status == "active":
        period_end = subscription.get("current_period_end")
        if period_end:
            period_end_dt = datetime.fromisoformat(period_end.replace("Z", "+00:00")) if isinstance(period_end, str) else period_end
            if now < period_end_dt:
                return True, {"status": "active", "subscription": subscription}
        else:
            # Period end yoksa aktif kabul et
            return True, {"status": "active", "subscription": subscription}
    
    # Trial durumu
    if status == "trial":
        trial_end = subscription.get("trial_end")
        if trial_end:
            trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00")) if isinstance(trial_end, str) else trial_end
            if now < trial_end_dt:
                days_left = (trial_end_dt - now).days
                return True, {
                    "status": "trial",
                    "subscription": subscription,
                    "trial_days_left": days_left,
                    "trial_end": trial_end
                }
    
    # Expired, locked, cancelled - erişim yok
    return False, {"status": status, "subscription": subscription}


async def start_trial(org_id: str, sector_id: str, user_id: str) -> Dict[str, Any]:
    """Yeni bir deneme süresi başlat"""
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    
    # Default plan bul (free veya starter)
    default_plan = await db.plans.find_one({
        "sector_id": sector_id,
        "type": {"$in": ["free", "starter"]},
        "is_active": True
    })
    
    plan_id = default_plan["id"] if default_plan else "default"
    
    subscription = {
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "sector_id": sector_id,
        "plan_id": plan_id,
        "status": "trial",
        "trial_start": now.isoformat(),
        "trial_end": trial_end.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # History kaydı
    await db.subscription_history.insert_one({
        "id": str(uuid.uuid4()),
        "subscription_id": subscription["id"],
        "organization_id": org_id,
        "sector_id": sector_id,
        "action": "trial_started",
        "from_status": None,
        "to_status": "trial",
        "to_plan_id": plan_id,
        "performed_by": user_id,
        "metadata": {"trial_days": TRIAL_DAYS},
        "created_at": now.isoformat()
    })
    
    logger.info(f"[TRIAL] Started {TRIAL_DAYS}-day trial for org={org_id}, sector={sector_id}")
    
    return subscription


async def subscription_middleware(
    request: Request,
    org_context: Dict[str, Any] = Depends(get_organization_context)
) -> Dict[str, Any]:
    """
    🔒 ANA ABONELİK MIDDLEWARE'İ
    
    Her sektör isteğinde çalışır ve şunları kontrol eder:
    1. Kullanıcı giriş yapmış mı? ✓ (get_current_user'da)
    2. Organizasyona erişimi var mı? ✓ (get_organization_context'de)
    3. İlgili sektöre erişim izni var mı?
    4. Aboneliği veya Trial süresi aktif mi?
    
    ❌ Erişim yoksa: 402 Payment Required döner
    ✅ VERİLER ASLA SİLİNMEZ - sadece kilitlenir
    """
    
    # URL'den sektör ID'sini çıkar
    sector_id = extract_sector_from_path(request.url.path)
    
    if not sector_id:
        # Sektör gerektirmeyen endpoint (auth, profile, vb.)
        return {
            **org_context,
            "sector_id": None,
            "subscription": None,
            "has_subscription": True  # Sektör yok, erişim serbest
        }
    
    org_id = org_context["org_id"]
    user_id = org_context["user_id"]
    
    # Kullanıcının bu sektöre erişim yetkisi var mı?
    sector_access = await db.user_sectors.find_one({
        "user_id": user_id,
        "organization_id": org_id,
        "sector_id": sector_id,
        "is_active": True
    })
    
    # Owner her sektöre erişebilir
    if not sector_access and not org_context.get("is_owner"):
        raise AccessDeniedError(f"'{sector_id}' sektörüne erişim izniniz yok.")
    
    # Abonelik durumunu kontrol et
    has_access, sub_info = await check_subscription_status(org_id, sector_id)
    
    if sub_info["status"] == "none":
        # İlk erişim - otomatik trial başlat
        subscription = await start_trial(org_id, sector_id, user_id)
        
        return {
            **org_context,
            "sector_id": sector_id,
            "subscription": subscription,
            "has_subscription": True,
            "is_trial": True,
            "trial_days_left": TRIAL_DAYS,
            "trial_end": subscription["trial_end"]
        }
    
    if has_access:
        # ✅ Erişim var
        return {
            **org_context,
            "sector_id": sector_id,
            "subscription": sub_info.get("subscription"),
            "has_subscription": True,
            "is_trial": sub_info["status"] == "trial",
            "trial_days_left": sub_info.get("trial_days_left", 0),
            "trial_end": sub_info.get("trial_end")
        }
    
    # ❌ ERİŞİM YOK - 402 Payment Required
    # ⚠️ VERİLER SİLİNMEDİ - SADECE KİLİTLİ
    
    subscription = sub_info.get("subscription", {})
    
    # Aboneliği "locked" olarak işaretle (henüz değilse)
    if subscription and subscription.get("status") not in ["locked", "cancelled"]:
        await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {
                "$set": {
                    "status": "locked",
                    "locked_at": datetime.now(timezone.utc).isoformat(),
                    "lock_reason": "payment_required"
                }
            }
        )
        
        # History kaydı
        await db.subscription_history.insert_one({
            "id": str(uuid.uuid4()),
            "subscription_id": subscription["id"],
            "organization_id": org_id,
            "sector_id": sector_id,
            "action": "locked",
            "from_status": subscription.get("status"),
            "to_status": "locked",
            "performed_by": "system",
            "metadata": {"reason": "subscription_expired"},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.warning(f"[LOCKED] Subscription locked for org={org_id}, sector={sector_id}")
    
    # Planları getir
    plans = await get_sector_plans(sector_id)
    
    # 402 Payment Required fırlat
    raise PaymentRequiredError(
        sector_id=sector_id,
        status=sub_info["status"],
        trial_ended_at=subscription.get("trial_end") if subscription else None,
        plans=plans
    )


# ==================== ROLE-BASED ACCESS CONTROL ====================

def require_role(*allowed_roles: str):
    """
    Belirli rollere erişim kısıtlaması
    Kullanım: @router.get("/admin", dependencies=[Depends(require_role("admin", "owner"))])
    """
    async def role_checker(context: Dict[str, Any] = Depends(subscription_middleware)):
        user_role = context.get("role", "viewer")
        if user_role not in allowed_roles:
            raise AccessDeniedError(f"Bu işlem için '{', '.join(allowed_roles)}' rollerinden biri gerekli.")
        return context
    
    return role_checker


# ==================== DATA ISOLATION HELPERS ====================

def get_tenant_filter(context: Dict[str, Any]) -> Dict[str, str]:
    """
    Multi-tenancy için filtre oluştur
    Her veritabanı sorgusunda kullanılmalı!
    """
    return {
        "organization_id": context["org_id"],
        "sector_id": context.get("sector_id")
    }


async def ensure_tenant_access(
    collection_name: str,
    document_id: str,
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Belirli bir dokümana erişim kontrolü
    Dökümanın tenant'a ait olduğundan emin ol
    """
    collection = db[collection_name]
    
    document = await collection.find_one({
        "id": document_id,
        "organization_id": context["org_id"]
    })
    
    if not document:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Kayıt bulunamadı."})
    
    # Sektör kontrolü (varsa)
    if context.get("sector_id") and document.get("sector_id"):
        if document["sector_id"] != context["sector_id"]:
            raise AccessDeniedError("Bu kaynağa erişim izniniz yok.")
    
    return document


# ==================== SUBSCRIPTION STATUS CHECKER ====================

async def get_subscription_summary(org_id: str) -> Dict[str, Any]:
    """
    Organizasyonun tüm sektörlerdeki abonelik durumunu getir
    Dashboard için kullanışlı
    """
    subscriptions = await db.subscriptions.find({
        "organization_id": org_id
    }).to_list(100)
    
    summary = {}
    now = datetime.now(timezone.utc)
    
    for sub in subscriptions:
        sector_id = sub.get("sector_id")
        status = sub.get("status")
        
        # Durum kontrolü
        is_active = False
        days_remaining = 0
        
        if status == "active":
            period_end = sub.get("current_period_end")
            if period_end:
                period_end_dt = datetime.fromisoformat(period_end.replace("Z", "+00:00")) if isinstance(period_end, str) else period_end
                is_active = now < period_end_dt
                days_remaining = max(0, (period_end_dt - now).days)
            else:
                is_active = True
        
        elif status == "trial":
            trial_end = sub.get("trial_end")
            if trial_end:
                trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00")) if isinstance(trial_end, str) else trial_end
                is_active = now < trial_end_dt
                days_remaining = max(0, (trial_end_dt - now).days)
        
        summary[sector_id] = {
            "subscription_id": sub.get("id"),
            "status": status,
            "is_active": is_active,
            "days_remaining": days_remaining,
            "plan_id": sub.get("plan_id"),
            "trial_end": sub.get("trial_end"),
            "period_end": sub.get("current_period_end")
        }
    
    return summary
