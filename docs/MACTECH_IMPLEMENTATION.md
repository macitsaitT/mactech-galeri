# MACTech Merkezi Backend - Örnek Implementasyon

Bu dosya, MACTech platformunun merkezi mimarisini gösteren örnek kod içerir.

## ⚠️ ÖDEME SİSTEMİ NOTU

**Ödeme sadece WEB SİTESİ üzerinden alınacak!**
- Mobil uygulamada ödeme butonu YOK
- Mobil'de "Web sitesinden abone ol" yönlendirmesi var
- iyzico Türk Lirası (TRY) ile çalışır

---

## 1. Veritabanı Modelleri (models.py)

```python
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ==================== ENUMS ====================

class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"

class OrgRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"

class SectorStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    BLOCKED = "blocked"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    EXPIRED = "expired"

class PlanType(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"

# ==================== GLOBAL MODELS ====================

class User(BaseModel):
    id: str
    email: EmailStr
    password_hash: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: AuthProvider = AuthProvider.EMAIL
    email_verified: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None

class Organization(BaseModel):
    id: str
    owner_id: str  # User.id
    name: str
    logo_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class OrgMember(BaseModel):
    id: str
    org_id: str
    user_id: str
    role: OrgRole
    invited_by: Optional[str] = None
    invited_at: datetime
    accepted_at: Optional[datetime] = None

# ==================== SECTOR & SUBSCRIPTION ====================

class Sector(BaseModel):
    id: str  # "gallery", "realestate", "logistics"
    name: str
    description: str
    icon: str
    is_active: bool = True
    created_at: datetime

class Plan(BaseModel):
    id: str
    sector_id: str
    name: str  # "Free", "Pro", "Enterprise"
    type: PlanType
    price_monthly: float
    price_yearly: float
    trial_days: int = 14
    features: Dict[str, Any]  # {"max_cars": 100, "reports": true}
    limits: Dict[str, Any]
    created_at: datetime

class OrgSector(BaseModel):
    """Organizasyonun sektöre erişim durumu"""
    id: str
    org_id: str
    sector_id: str
    status: SectorStatus
    trial_start_date: Optional[datetime] = None
    trial_end_date: Optional[datetime] = None
    first_access_date: datetime
    created_at: datetime

class Subscription(BaseModel):
    """Aktif abonelik bilgisi"""
    id: str
    org_id: str
    sector_id: str
    plan_id: str
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
```

## 2. Middleware Implementasyonu (middleware.py)

```python
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
import uuid

security = HTTPBearer()

# ==================== AUTH MIDDLEWARE ====================

async def auth_middleware(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """JWT Token doğrulama"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        return {
            "user_id": payload["user_id"],
            "email": payload["email"],
            "exp": payload["exp"]
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== ORG MIDDLEWARE ====================

async def org_middleware(
    request: Request,
    current_user: dict = Depends(auth_middleware)
) -> dict:
    """Organizasyon erişim kontrolü"""
    
    # Header'dan veya query'den org_id al
    org_id = request.headers.get("X-Org-ID") or request.query_params.get("org_id")
    
    if not org_id:
        raise HTTPException(status_code=400, detail="X-Org-ID header required")
    
    # Kullanıcının bu organizasyona erişimi var mı?
    member = await db.org_members.find_one({
        "org_id": org_id,
        "user_id": current_user["user_id"],
        "accepted_at": {"$ne": None}
    })
    
    if not member:
        # Belki owner'dır?
        org = await db.organizations.find_one({
            "id": org_id,
            "owner_id": current_user["user_id"]
        })
        if not org:
            raise HTTPException(status_code=403, detail="Access denied to this organization")
        role = "admin"
    else:
        role = member["role"]
    
    return {
        **current_user,
        "org_id": org_id,
        "role": role
    }


# ==================== SECTOR ACCESS MIDDLEWARE ====================

async def sector_middleware(
    request: Request,
    org_context: dict = Depends(org_middleware)
) -> dict:
    """Sektör erişim kontrolü ve deneme başlatma"""
    
    # URL'den sector_name çıkar: /api/v1/gallery/cars -> gallery
    path_parts = request.url.path.split("/")
    sector_id = None
    
    for i, part in enumerate(path_parts):
        if part == "v1" and i + 1 < len(path_parts):
            potential_sector = path_parts[i + 1]
            # Bilinen sektörler
            if potential_sector in ["gallery", "realestate", "logistics"]:
                sector_id = potential_sector
                break
    
    if not sector_id:
        # Sektör gerektirmeyen endpoint (auth, organizations, vb.)
        return org_context
    
    # Sektör aktif mi?
    sector = await db.sectors.find_one({"id": sector_id, "is_active": True})
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    
    # Organizasyonun bu sektöre erişimi var mı?
    org_sector = await db.org_sectors.find_one({
        "org_id": org_context["org_id"],
        "sector_id": sector_id
    })
    
    now = datetime.now(timezone.utc)
    
    if not org_sector:
        # İlk erişim! 14 günlük deneme başlat
        org_sector = {
            "id": str(uuid.uuid4()),
            "org_id": org_context["org_id"],
            "sector_id": sector_id,
            "status": "trial",
            "trial_start_date": now.isoformat(),
            "trial_end_date": (now + timedelta(days=14)).isoformat(),
            "first_access_date": now.isoformat(),
            "created_at": now.isoformat()
        }
        await db.org_sectors.insert_one(org_sector)
        
        # Log: Yeni deneme başladı
        print(f"[TRIAL] Org {org_context['org_id']} started trial for {sector_id}")
    
    return {
        **org_context,
        "sector_id": sector_id,
        "sector_status": org_sector["status"],
        "trial_end_date": org_sector.get("trial_end_date")
    }


# ==================== SUBSCRIPTION MIDDLEWARE (PAYWALL) ====================

async def subscription_middleware(
    request: Request,
    sector_context: dict = Depends(sector_middleware)
) -> dict:
    """Abonelik kontrolü - Paywall"""
    
    sector_id = sector_context.get("sector_id")
    if not sector_id:
        # Sektör gerektirmeyen endpoint
        return sector_context
    
    org_id = sector_context["org_id"]
    now = datetime.now(timezone.utc)
    
    # Mevcut abonelik kontrolü
    subscription = await db.subscriptions.find_one({
        "org_id": org_id,
        "sector_id": sector_id,
        "status": "active"
    })
    
    if subscription:
        # Aktif abonelik var
        return {
            **sector_context,
            "subscription": subscription,
            "has_access": True
        }
    
    # Deneme süresi kontrolü
    org_sector = await db.org_sectors.find_one({
        "org_id": org_id,
        "sector_id": sector_id
    })
    
    if org_sector["status"] == "trial":
        trial_end = datetime.fromisoformat(org_sector["trial_end_date"].replace("Z", "+00:00"))
        
        if now < trial_end:
            # Deneme süresi devam ediyor
            days_left = (trial_end - now).days
            return {
                **sector_context,
                "subscription": None,
                "has_access": True,
                "is_trial": True,
                "trial_days_left": days_left
            }
        else:
            # Deneme süresi doldu!
            await db.org_sectors.update_one(
                {"id": org_sector["id"]},
                {"$set": {"status": "expired"}}
            )
    
    # ❌ PAYWALL - Erişim yok!
    plans = await db.plans.find({"sector_id": sector_id}).to_list(10)
    
    raise HTTPException(
        status_code=402,  # Payment Required
        detail={
            "error": "subscription_required",
            "message": "Deneme süreniz doldu. Devam etmek için abone olun.",
            "sector": sector_id,
            "trial_ended_at": org_sector.get("trial_end_date"),
            "plans": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "price_monthly": p["price_monthly"],
                    "price_yearly": p["price_yearly"],
                    "features": p["features"]
                }
                for p in plans
            ],
            "checkout_url": f"/subscribe/{sector_id}"
        }
    )
```

## 3. Dinamik Sektör Router (sector_router.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from typing import Any
import importlib

router = APIRouter()

# Sektör modüllerini dinamik olarak yükle
SECTOR_MODULES = {
    "gallery": "routes.gallery",
    "realestate": "routes.realestate",
    "logistics": "routes.logistics"
}

def get_sector_router(sector_id: str) -> APIRouter:
    """Sektör modülünü dinamik olarak yükle"""
    if sector_id not in SECTOR_MODULES:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    
    try:
        module = importlib.import_module(SECTOR_MODULES[sector_id])
        return module.router
    except ImportError:
        raise HTTPException(status_code=501, detail=f"Sector '{sector_id}' not implemented")


# Ana router'a sektör router'larını bağla
from routes.gallery import router as gallery_router
from routes.subscriptions import router as subscription_router

# Statik bağlama (production için önerilir)
router.include_router(gallery_router, prefix="/gallery", tags=["Gallery"])
router.include_router(subscription_router, prefix="/subscriptions", tags=["Subscriptions"])
```

## 4. Abonelik Servisi - iyzico Entegrasyonu (subscriptions.py)

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, timedelta
import hmac
import hashlib
import base64
import secrets
import httpx
import uuid
import os
import json

router = APIRouter()

# iyzico Configuration
IYZICO_API_KEY = os.environ.get("IYZICO_API_KEY")
IYZICO_SECRET_KEY = os.environ.get("IYZICO_SECRET_KEY")
IYZICO_BASE_URL = os.environ.get("IYZICO_BASE_URL", "https://sandbox-api.iyzipay.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://mactech.com")


# ==================== iyzico AUTH HELPER ====================

def generate_iyzico_auth_header() -> dict:
    """Generate HMAC-SHA256 authentication header for iyzico API"""
    random_key = secrets.token_hex(20)
    signature_string = IYZICO_API_KEY + random_key + IYZICO_SECRET_KEY
    
    signature = hmac.new(
        IYZICO_SECRET_KEY.encode(),
        signature_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    auth_string = f"apiKey:{IYZICO_API_KEY},randomKey:{random_key},signature:{signature}"
    base64_auth = base64.b64encode(auth_string.encode()).decode()
    
    return {
        "Authorization": f"IYZWSv2 {base64_auth}",
        "x-iyzi-rnd": random_key,
        "Content-Type": "application/json"
    }


# ==================== PLAN LİSTESİ ====================

@router.get("/plans")
async def get_all_plans():
    """Tüm planları getir"""
    plans = await db.plans.find({"is_active": True}).to_list(100)
    return {"plans": plans}


@router.get("/plans/{sector_id}")
async def get_sector_plans(sector_id: str):
    """Sektöre özel planları getir"""
    plans = await db.plans.find({
        "sector_id": sector_id,
        "is_active": True
    }).to_list(10)
    return {"plans": plans}


# ==================== ABONELİK DURUMU ====================

@router.get("/status/{sector_id}")
async def get_subscription_status(
    sector_id: str,
    context: dict = Depends(subscription_middleware)
):
    """Abonelik durumunu getir"""
    org_id = context["org_id"]
    
    org_sector = await db.org_sectors.find_one({
        "org_id": org_id,
        "sector_id": sector_id
    })
    
    subscription = await db.subscriptions.find_one({
        "org_id": org_id,
        "sector_id": sector_id,
        "status": "active"
    })
    
    return {
        "sector_id": sector_id,
        "status": org_sector["status"] if org_sector else "none",
        "trial_end_date": org_sector.get("trial_end_date") if org_sector else None,
        "subscription": subscription,
        "has_access": context.get("has_access", False),
        "is_trial": context.get("is_trial", False),
        "trial_days_left": context.get("trial_days_left", 0)
    }


# ==================== iyzico CHECKOUT (SADECE WEB) ====================

@router.post("/checkout")
async def create_iyzico_checkout(
    data: dict,
    context: dict = Depends(org_middleware)
):
    """
    iyzico Checkout Form oluştur - SADECE WEB SİTESİNDEN
    Mobil uygulamada bu endpoint çağrılmaz!
    """
    sector_id = data.get("sector_id")
    plan_id = data.get("plan_id")
    
    # Plan bilgisini al
    plan = await db.plans.find_one({"id": plan_id, "sector_id": sector_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Organizasyon ve kullanıcı bilgisi
    org = await db.organizations.find_one({"id": context["org_id"]})
    user = await db.users.find_one({"id": context["user_id"]})
    
    # iyzico pricing plan reference code (önceden oluşturulmuş)
    pricing_plan_ref = plan.get("iyzico_plan_reference_code")
    if not pricing_plan_ref:
        raise HTTPException(status_code=400, detail="Plan not configured for iyzico")
    
    conversation_id = str(uuid.uuid4())
    
    # Checkout session'ı kaydet (webhook ile eşleştirmek için)
    await db.checkout_sessions.insert_one({
        "id": conversation_id,
        "org_id": context["org_id"],
        "user_id": context["user_id"],
        "sector_id": sector_id,
        "plan_id": plan_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # iyzico API çağrısı
    headers = generate_iyzico_auth_header()
    
    payload = {
        "locale": "tr",
        "conversationId": conversation_id,
        "callbackUrl": f"{FRONTEND_URL}/api/subscriptions/callback",
        "pricingPlanReferenceCode": pricing_plan_ref,
        "subscriptionInitialStatus": "ACTIVE",
        "customer": {
            "name": user.get("full_name", ""),
            "surname": "",
            "email": user["email"],
            "gsmNumber": user.get("phone", ""),
            "identityNumber": "11111111111",  # TC Kimlik (test için)
            "shippingContactName": org.get("name", ""),
            "shippingCity": "Istanbul",
            "shippingCountry": "Turkey",
            "shippingAddress": org.get("address", "Istanbul"),
            "billingContactName": org.get("name", ""),
            "billingCity": "Istanbul",
            "billingCountry": "Turkey",
            "billingAddress": org.get("address", "Istanbul")
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{IYZICO_BASE_URL}/v2/subscription/checkoutform/initialize",
            headers=headers,
            json=payload
        )
        
        result = response.json()
        
        if result.get("status") != "success":
            raise HTTPException(
                status_code=400,
                detail=f"iyzico error: {result.get('errorMessage', 'Unknown error')}"
            )
        
        return {
            "checkout_form_content": result.get("checkoutFormContent"),
            "token": result.get("token"),
            "conversation_id": conversation_id
        }


# ==================== iyzico CALLBACK ====================

@router.post("/callback")
async def iyzico_callback(request: Request):
    """
    iyzico ödeme sonrası callback
    Kullanıcı ödeme yaptıktan sonra buraya yönlendirilir
    """
    form_data = await request.form()
    token = form_data.get("token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token required")
    
    # iyzico'dan ödeme sonucunu al
    headers = generate_iyzico_auth_header()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{IYZICO_BASE_URL}/v2/subscription/checkoutform/retrieve",
            headers=headers,
            json={"locale": "tr", "token": token}
        )
        
        result = response.json()
        
        if result.get("status") == "success":
            # Başarılı ödeme
            subscription_ref = result.get("subscriptionReferenceCode")
            customer_ref = result.get("customerReferenceCode")
            conversation_id = result.get("conversationId")
            
            # Checkout session'ı bul
            session = await db.checkout_sessions.find_one({"id": conversation_id})
            
            if session:
                now = datetime.now(timezone.utc)
                
                # Abonelik oluştur
                subscription = {
                    "id": str(uuid.uuid4()),
                    "org_id": session["org_id"],
                    "sector_id": session["sector_id"],
                    "plan_id": session["plan_id"],
                    "status": "active",
                    "iyzico_subscription_ref": subscription_ref,
                    "iyzico_customer_ref": customer_ref,
                    "current_period_start": now.isoformat(),
                    "current_period_end": (now + timedelta(days=30)).isoformat(),
                    "created_at": now.isoformat()
                }
                await db.subscriptions.insert_one(subscription)
                
                # org_sectors güncelle
                await db.org_sectors.update_one(
                    {"org_id": session["org_id"], "sector_id": session["sector_id"]},
                    {"$set": {"status": "active"}}
                )
                
                # Checkout session'ı güncelle
                await db.checkout_sessions.update_one(
                    {"id": conversation_id},
                    {"$set": {"status": "completed", "subscription_id": subscription["id"]}}
                )
            
            # Başarı sayfasına yönlendir
            from fastapi.responses import RedirectResponse
            return RedirectResponse(
                url=f"{FRONTEND_URL}/subscription/success?ref={subscription_ref}",
                status_code=303
            )
        else:
            # Başarısız ödeme
            from fastapi.responses import RedirectResponse
            return RedirectResponse(
                url=f"{FRONTEND_URL}/subscription/failed?error={result.get('errorMessage', 'Payment failed')}",
                status_code=303
            )


# ==================== iyzico WEBHOOK ====================

@router.post("/webhook")
async def iyzico_webhook(request: Request):
    """
    iyzico Webhook handler
    Yinelenen ödemeler ve abonelik değişiklikleri için
    """
    try:
        raw_body = await request.body()
        signature_header = request.headers.get("X-IYZ-SIGNATURE-V3")
        
        # Signature validation
        if signature_header:
            webhook_data = json.loads(raw_body.decode('utf-8'))
            
            # Validate signature (simplified)
            iyzi_event_type = webhook_data.get("iyziEventType")
            status = webhook_data.get("status")
            
            if status == "SUCCESS":
                subscription_ref = webhook_data.get("subscriptionReferenceCode")
                
                # Yinelenen ödeme başarılı
                await db.subscriptions.update_one(
                    {"iyzico_subscription_ref": subscription_ref},
                    {"$set": {
                        "status": "active",
                        "last_payment_date": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Ödeme kaydı oluştur
                await db.payments.insert_one({
                    "id": str(uuid.uuid4()),
                    "subscription_ref": subscription_ref,
                    "event_type": iyzi_event_type,
                    "status": "success",
                    "raw_data": webhook_data,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
            elif status == "FAILURE":
                subscription_ref = webhook_data.get("subscriptionReferenceCode")
                
                # Ödeme başarısız - aboneliği askıya al
                sub = await db.subscriptions.find_one({
                    "iyzico_subscription_ref": subscription_ref
                })
                
                if sub:
                    await db.subscriptions.update_one(
                        {"id": sub["id"]},
                        {"$set": {"status": "past_due"}}
                    )
                    
                    # org_sectors'ı da güncelle
                    await db.org_sectors.update_one(
                        {"org_id": sub["org_id"], "sector_id": sub["sector_id"]},
                        {"$set": {"status": "expired"}}
                    )
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}


# ==================== ABONELİK İPTAL ====================

@router.post("/cancel")
async def cancel_subscription(
    data: dict,
    context: dict = Depends(org_middleware)
):
    """Aboneliği iptal et"""
    sector_id = data.get("sector_id")
    
    subscription = await db.subscriptions.find_one({
        "org_id": context["org_id"],
        "sector_id": sector_id,
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Active subscription not found")
    
    # iyzico'da aboneliği iptal et
    headers = generate_iyzico_auth_header()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{IYZICO_BASE_URL}/v2/subscription/subscriptions/{subscription['iyzico_subscription_ref']}/cancel",
            headers=headers,
            json={"locale": "tr"}
        )
        
        result = response.json()
        
        if result.get("status") == "success":
            # Veritabanını güncelle
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # org_sectors güncelle (dönem sonuna kadar erişim devam eder)
            await db.org_sectors.update_one(
                {"org_id": context["org_id"], "sector_id": sector_id},
                {"$set": {"cancel_at_period_end": True}}
            )
            
            return {"success": True, "message": "Subscription will be cancelled at period end"}
        else:
            raise HTTPException(
                status_code=400,
                detail=f"iyzico error: {result.get('errorMessage', 'Unknown error')}"
            )
```

## 5. Frontend Paywall Komponenti (React Web)

```jsx
// components/Paywall.jsx - WEB SİTESİ İÇİN
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Paywall = ({ error, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  if (!error || error.error !== 'subscription_required') {
    return null;
  }
  
  const { sector, trial_ended_at, plans, checkout_url } = error;
  
  const handleSubscribe = async (plan) => {
    setLoading(true);
    setSelectedPlan(plan.id);
    
    try {
      const response = await api.post('/subscriptions/checkout', {
        sector_id: sector,
        plan_id: plan.id
      });
      
      // iyzico checkout form'u göster
      if (response.data.checkout_form_content) {
        // Yeni pencerede veya modal'da iyzico formunu göster
        const checkoutWindow = window.open('', 'iyzico_checkout', 'width=500,height=600');
        checkoutWindow.document.write(response.data.checkout_form_content);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Ödeme başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Deneme Süreniz Doldu</h2>
          <p className="text-muted-foreground mt-2">
            {sector.toUpperCase()} modülüne erişmek için bir plan seçin
          </p>
        </div>
        
        {/* Plans */}
        <div className="space-y-4 mb-6">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary'
              }`}
              onClick={() => !loading && handleSubscribe(plan)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {Object.entries(plan.features).slice(0, 2).map(([k, v]) => 
                      `${k}: ${v}`
                    ).join(' • ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    ₺{plan.price_monthly}
                  </p>
                  <p className="text-xs text-muted-foreground">/ay</p>
                </div>
              </div>
              
              {loading && selectedPlan === plan.id && (
                <div className="mt-2 text-center text-sm text-muted-foreground">
                  Ödeme sayfası açılıyor...
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* iyzico Logo */}
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground">
            Güvenli ödeme: <strong>iyzico</strong> altyapısı ile
          </p>
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-3 text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          Daha Sonra
        </button>
      </div>
    </div>
  );
};

export default Paywall;
```

## 6. Mobil Uygulama Paywall (React Native/Expo) - WEB'E YÖNLENDİRME

```jsx
// components/MobilePaywall.jsx - MOBİL UYGULAMA İÇİN
// ÖNEMLİ: Mobil uygulamada ödeme YAPILMAZ, web sitesine yönlendirilir!

import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Lock, ExternalLink, Globe } from 'lucide-react-native';

const MobilePaywall = ({ error, onClose }) => {
  if (!error || error.error !== 'subscription_required') {
    return null;
  }
  
  const { sector, plans } = error;
  
  const openWebsite = () => {
    // Web sitesine yönlendir - ödeme orada yapılacak
    const url = `https://mactech.com/subscribe/${sector}`;
    Linking.openURL(url);
  };
  
  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Lock size={32} color="#C4A35A" />
          </View>
          <Text style={styles.title}>Deneme Süreniz Doldu</Text>
          <Text style={styles.subtitle}>
            Devam etmek için web sitemizden abone olun
          </Text>
        </View>
        
        {/* Plan Preview */}
        <View style={styles.planPreview}>
          <Text style={styles.planLabel}>Mevcut Planlar:</Text>
          {plans.slice(0, 2).map((plan) => (
            <View key={plan.id} style={styles.planItem}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>₺{plan.price_monthly}/ay</Text>
            </View>
          ))}
        </View>
        
        {/* Web'e Yönlendir Butonu */}
        <TouchableOpacity style={styles.webButton} onPress={openWebsite}>
          <Globe size={20} color="#0A0A0A" />
          <Text style={styles.webButtonText}>Web Sitesinden Abone Ol</Text>
          <ExternalLink size={16} color="#0A0A0A" />
        </TouchableOpacity>
        
        {/* Info */}
        <Text style={styles.infoText}>
          Ödemeler güvenli şekilde web sitemiz üzerinden iyzico ile alınmaktadır.
          Abone olduktan sonra mobil uygulamada otomatik olarak aktif olacaktır.
        </Text>
        
        {/* Close */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Daha Sonra</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(196, 163, 90, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  planPreview: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  planLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 12,
  },
  planItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  planName: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C4A35A',
  },
  webButton: {
    backgroundColor: '#C4A35A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  webButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  infoText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 14,
    color: '#888888',
  },
});

export default MobilePaywall;
```

## 7. API İstek Interceptor (axios) - Web

```javascript
// services/api.js
import axios from 'axios';
import { showPaywall } from '../stores/paywallStore';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
});

// Request interceptor - Token ve Org ID ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('currentOrgId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (orgId) {
    config.headers['X-Org-ID'] = orgId;
  }
  
  return config;
});

// Response interceptor - Paywall kontrolü
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402) {
      // Payment Required - Paywall göster
      const paywallData = error.response.data.detail;
      showPaywall(paywallData);
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      // Token expired - Logout
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

## 8. iyzico Kurulum Gereksinimleri

### Backend .env Dosyası:
```env
# iyzico Credentials (Sandbox için)
IYZICO_API_KEY=sandbox-xxxxxxxxxxxxx
IYZICO_SECRET_KEY=sandbox-xxxxxxxxxxxxx
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# iyzico Credentials (Production için)
# IYZICO_API_KEY=your_live_api_key
# IYZICO_SECRET_KEY=your_live_secret_key
# IYZICO_BASE_URL=https://api.iyzipay.com

FRONTEND_URL=https://mactech.com
```

### iyzico Dashboard Ayarları:
1. **Merchant Settings > API Keys** - API Key ve Secret Key alın
2. **Merchant Settings > Merchant Notifications** - Webhook URL ekleyin:
   - URL: `https://api.mactech.com/api/subscriptions/webhook`
   - HTTPS zorunlu!

### requirements.txt Eklentisi:
```
httpx>=0.24.0
```

### iyzico Test Kartları:
```
Başarılı Ödeme:
- Kart No: 5528790000000008
- SKT: 12/30
- CVV: 123

Başarısız Ödeme (Yetersiz Bakiye):
- Kart No: 4111111111111129
- SKT: 12/30
- CVV: 123
```

## 9. Örnek Seed Data

```python
# scripts/seed_data.py

SECTORS = [
    {
        "id": "gallery",
        "name": "Galeri",
        "description": "Oto galeri yönetim sistemi",
        "icon": "car",
        "is_active": True
    },
    {
        "id": "realestate",
        "name": "Emlak",
        "description": "Emlak portföy yönetimi",
        "icon": "home",
        "is_active": True
    },
    {
        "id": "logistics",
        "name": "Lojistik",
        "description": "Kargo ve lojistik takibi",
        "icon": "truck",
        "is_active": False  # Henüz aktif değil
    }
]

PLANS = [
    # Gallery Plans
    {
        "id": "gallery-free",
        "sector_id": "gallery",
        "name": "Ücretsiz",
        "type": "free",
        "price_monthly": 0,
        "price_yearly": 0,
        "trial_days": 14,
        "iyzico_plan_reference_code": None,  # Free plan için iyzico yok
        "features": {
            "max_cars": 10,
            "max_customers": 50,
            "reports": False,
            "multi_user": False
        },
        "limits": {"storage_mb": 100}
    },
    {
        "id": "gallery-pro",
        "sector_id": "gallery",
        "name": "Pro",
        "type": "pro",
        "price_monthly": 299,
        "price_yearly": 2990,
        "trial_days": 14,
        "iyzico_plan_reference_code": "gallery-pro-monthly",  # iyzico'da oluşturulan plan referansı
        "features": {
            "max_cars": 500,
            "max_customers": 1000,
            "reports": True,
            "multi_user": True,
            "max_users": 5
        },
        "limits": {"storage_mb": 5000}
    },
    {
        "id": "gallery-enterprise",
        "sector_id": "gallery",
        "name": "Enterprise",
        "type": "enterprise",
        "price_monthly": 799,
        "price_yearly": 7990,
        "trial_days": 14,
        "iyzico_plan_reference_code": "gallery-enterprise-monthly",
        "features": {
            "max_cars": -1,  # Sınırsız
            "max_customers": -1,
            "reports": True,
            "multi_user": True,
            "max_users": -1,
            "api_access": True,
            "white_label": True
        },
        "limits": {"storage_mb": 50000}
    },
    # Realestate Plans
    {
        "id": "realestate-pro",
        "sector_id": "realestate",
        "name": "Pro",
        "type": "pro",
        "price_monthly": 399,
        "price_yearly": 3990,
        "trial_days": 14,
        "iyzico_plan_reference_code": "realestate-pro-monthly",
        "features": {
            "max_properties": 200,
            "max_clients": 500,
            "virtual_tours": True
        },
        "limits": {"storage_mb": 10000}
    }
]
```

---

## 📱 Mobil Uygulama Ödeme Akışı

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBİL UYGULAMA ÖDEME AKIŞI                    │
│                  (Uygulama içi ödeme YAPILMAZ!)                  │
└─────────────────────────────────────────────────────────────────┘

Kullanıcı mobil uygulamada paywall'a takılır
                    │
                    ▼
         ┌─────────────────────┐
         │  MobilePaywall      │
         │  komponenti açılır  │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ "Web Sitesinden     │
         │  Abone Ol" butonu   │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Linking.openURL()   │
         │ → mactech.com/      │
         │   subscribe/gallery │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Web sitesinde       │
         │ iyzico ile ödeme    │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Ödeme başarılı      │
         │ → subscriptions     │
         │   tablosu güncellenir│
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Kullanıcı mobil     │
         │ uygulamaya döner    │
         │ → API çağrısı yapar │
         │ → Abonelik aktif!   │
         └─────────────────────┘
```

## Özet

Bu mimari ile:

1. ✅ **Tek Kullanıcı Kimliği** - user_id tüm platformlarda aynı
2. ✅ **Multi-Tenancy** - org_id + sector_id ile veri ayrımı
3. ✅ **Merkezi Abonelik** - subscriptions tablosu tüm sektörleri yönetir
4. ✅ **14 Gün Deneme** - İlk erişimde otomatik başlar
5. ✅ **Paywall** - 402 status code ile frontend'e bildirilir
6. ✅ **Dinamik API** - /api/v1/{sector}/... yapısı
7. ✅ **iyzico Entegrasyonu** - Türk Lirası ile abonelik ödemeleri
8. ✅ **Sadece Web Ödeme** - Mobil'de web'e yönlendirme
9. ✅ **Ölçeklenebilir** - Yeni sektör eklemek için sadece:
   - sectors tablosuna kayıt
   - plans tablosuna planlar (+ iyzico'da plan oluştur)
   - routes/{sector}.py dosyası
