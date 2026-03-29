# MACTech Merkezi Backend - Örnek Implementasyon

Bu dosya, MACTech platformunun merkezi mimarisini gösteren örnek kod içerir.

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

## 4. Abonelik Servisi (subscriptions.py)

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
import stripe
import uuid
import os

router = APIRouter()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

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


# ==================== STRIPE CHECKOUT ====================

@router.post("/checkout")
async def create_checkout_session(
    data: dict,
    context: dict = Depends(org_middleware)
):
    """Stripe Checkout Session oluştur"""
    sector_id = data.get("sector_id")
    plan_id = data.get("plan_id")
    period = data.get("period", "monthly")  # monthly veya yearly
    
    # Plan bilgisini al
    plan = await db.plans.find_one({"id": plan_id, "sector_id": sector_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Organizasyon bilgisi
    org = await db.organizations.find_one({"id": context["org_id"]})
    user = await db.users.find_one({"id": context["user_id"]})
    
    # Stripe müşteri oluştur veya bul
    existing_sub = await db.subscriptions.find_one({
        "org_id": context["org_id"],
        "stripe_customer_id": {"$exists": True}
    })
    
    if existing_sub and existing_sub.get("stripe_customer_id"):
        customer_id = existing_sub["stripe_customer_id"]
    else:
        customer = stripe.Customer.create(
            email=user["email"],
            name=org["name"],
            metadata={
                "org_id": context["org_id"],
                "user_id": context["user_id"]
            }
        )
        customer_id = customer.id
    
    # Fiyat belirle
    price = plan["price_yearly"] if period == "yearly" else plan["price_monthly"]
    interval = "year" if period == "yearly" else "month"
    
    # Stripe Price oluştur (veya mevcut kullan)
    stripe_price = stripe.Price.create(
        unit_amount=int(price * 100),  # Kuruş cinsinden
        currency="try",
        recurring={"interval": interval},
        product_data={
            "name": f"{plan['name']} - {sector_id.title()}",
            "metadata": {
                "sector_id": sector_id,
                "plan_id": plan_id
            }
        }
    )
    
    # Checkout Session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{
            "price": stripe_price.id,
            "quantity": 1
        }],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/subscription/cancel",
        metadata={
            "org_id": context["org_id"],
            "sector_id": sector_id,
            "plan_id": plan_id
        }
    )
    
    return {
        "checkout_url": session.url,
        "session_id": session.id
    }


# ==================== STRIPE WEBHOOK ====================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe Webhook handler"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Event handling
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session)
    
    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        await handle_invoice_paid(invoice)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_cancelled(subscription)
    
    return {"status": "success"}


async def handle_checkout_completed(session: dict):
    """Ödeme tamamlandığında abonelik oluştur"""
    org_id = session["metadata"]["org_id"]
    sector_id = session["metadata"]["sector_id"]
    plan_id = session["metadata"]["plan_id"]
    
    now = datetime.now(timezone.utc)
    
    # Abonelik oluştur
    subscription = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "sector_id": sector_id,
        "plan_id": plan_id,
        "status": "active",
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=30)).isoformat(),
        "stripe_customer_id": session["customer"],
        "stripe_subscription_id": session["subscription"],
        "created_at": now.isoformat()
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # org_sectors güncelle
    await db.org_sectors.update_one(
        {"org_id": org_id, "sector_id": sector_id},
        {"$set": {"status": "active"}}
    )
    
    print(f"[SUBSCRIPTION] Org {org_id} subscribed to {sector_id} ({plan_id})")


async def handle_subscription_cancelled(stripe_sub: dict):
    """Abonelik iptal edildiğinde"""
    sub = await db.subscriptions.find_one({
        "stripe_subscription_id": stripe_sub["id"]
    })
    
    if sub:
        await db.subscriptions.update_one(
            {"id": sub["id"]},
            {"$set": {"status": "cancelled"}}
        )
        
        await db.org_sectors.update_one(
            {"org_id": sub["org_id"], "sector_id": sub["sector_id"]},
            {"$set": {"status": "expired"}}
        )
        
        print(f"[CANCELLED] Subscription {sub['id']} cancelled")
```

## 5. Frontend Paywall Komponenti (React)

```jsx
// components/Paywall.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Paywall = ({ error, onClose }) => {
  const navigate = useNavigate();
  
  if (!error || error.error !== 'subscription_required') {
    return null;
  }
  
  const { sector, trial_ended_at, plans, checkout_url } = error;
  
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
              className="border border-border rounded-xl p-4 hover:border-primary transition-colors cursor-pointer"
              onClick={() => navigate(`/subscribe/${sector}?plan=${plan.id}`)}
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
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <button
          onClick={() => navigate(checkout_url)}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          Plan Seç ve Devam Et
        </button>
        
        <button
          onClick={onClose}
          className="w-full mt-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          Daha Sonra
        </button>
      </div>
    </div>
  );
};

export default Paywall;
```

## 6. API İstek Interceptor (axios)

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

## 7. Örnek Seed Data

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

## Özet

Bu mimari ile:

1. ✅ **Tek Kullanıcı Kimliği** - user_id tüm platformlarda aynı
2. ✅ **Multi-Tenancy** - org_id + sector_id ile veri ayrımı
3. ✅ **Merkezi Abonelik** - subscriptions tablosu tüm sektörleri yönetir
4. ✅ **14 Gün Deneme** - İlk erişimde otomatik başlar
5. ✅ **Paywall** - 402 status code ile frontend'e bildirilir
6. ✅ **Dinamik API** - /api/v1/{sector}/... yapısı
7. ✅ **Ölçeklenebilir** - Yeni sektör eklemek için sadece:
   - sectors tablosuna kayıt
   - plans tablosuna planlar
   - routes/{sector}.py dosyası
