# MACTech Multi-Tenant SaaS - Entegrasyon Rehberi

## 📁 Oluşturulan Dosyalar

```
/backend/
├── models/
│   └── database_models.py       # MongoDB koleksiyon yapıları
└── middleware/
    └── subscription_middleware.py # Abonelik kontrolü middleware

/frontend/
├── services/
│   └── apiMultiTenant.js        # Axios interceptor (402 handler)
├── components/
│   ├── PaywallOverlay.jsx       # Abonelik paywall komponenti
│   └── TrialWarningBanner.jsx   # Trial uyarı banner'ı
└── hooks/
    └── useSubscription.js       # Abonelik hook'ları
```

---

## 🔧 Backend Entegrasyonu

### 1. Router'a Middleware Ekleme

```python
# /backend/routes/gallery.py

from fastapi import APIRouter, Depends
from middleware.subscription_middleware import (
    subscription_middleware,
    get_tenant_filter,
    require_role
)

router = APIRouter(prefix="/api/v1/gallery", tags=["Gallery"])

# Tüm endpoint'lerde subscription middleware kullan
@router.get("/cars")
async def list_cars(
    context: dict = Depends(subscription_middleware)  # 🔒 Abonelik kontrolü
):
    # Multi-tenancy filtresi
    tenant_filter = get_tenant_filter(context)
    
    cars = await db.gallery_cars.find(tenant_filter).to_list(100)
    return {"cars": cars}


@router.post("/cars")
async def create_car(
    data: dict,
    context: dict = Depends(subscription_middleware)
):
    car = {
        **data,
        "id": str(uuid.uuid4()),
        "organization_id": context["org_id"],  # 🔒 Tenant isolation
        "sector_id": context["sector_id"],
        "created_by": context["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gallery_cars.insert_one(car)
    return car


# Sadece admin/owner erişebilir
@router.delete("/cars/{car_id}")
async def delete_car(
    car_id: str,
    context: dict = Depends(require_role("admin", "owner"))  # 🔒 Rol kontrolü
):
    await ensure_tenant_access("gallery_cars", car_id, context)
    await db.gallery_cars.delete_one({"id": car_id})
    return {"success": True}
```

### 2. Server.py'a Middleware Ekleme

```python
# /backend/server.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routes
from routes import gallery, realestate, subscriptions, auth

app = FastAPI(title="MACTech API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router'ları ekle
app.include_router(auth.router)
app.include_router(subscriptions.router)
app.include_router(gallery.router)      # /api/v1/gallery/...
app.include_router(realestate.router)   # /api/v1/realestate/...
```

---

## 🎨 Frontend Entegrasyonu

### 1. App.js'e PaywallProvider Ekleme

```jsx
// /frontend/src/App.js

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { PaywallProvider } from './components/PaywallOverlay';
import { AppProvider } from './context/AppContext';
import Routes from './Routes';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <PaywallProvider>  {/* 🔒 Paywall overlay'i wrap et */}
          <Routes />
        </PaywallProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
```

### 2. Sayfalarda Kullanım

```jsx
// /frontend/src/pages/GalleryDashboard.jsx

import React, { useEffect, useState } from 'react';
import { galleryAPI } from '../services/apiMultiTenant';
import { useSubscription } from '../hooks/useSubscription';
import TrialWarningBanner from '../components/TrialWarningBanner';
import { usePaywall } from '../components/PaywallOverlay';

const GalleryDashboard = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Abonelik durumu
  const { isTrial, daysLeft, hasAccess } = useSubscription('gallery');
  const { showPaywall } = usePaywall();

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const response = await galleryAPI.list('cars');
        setCars(response.data.cars);
      } catch (error) {
        // 402 hatası otomatik olarak PaywallOverlay'i tetikler
        // Diğer hatalar burada handle edilir
        if (error.error !== 'payment_required') {
          console.error('Error:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, []);

  const handleUpgrade = () => {
    showPaywall({
      isVisible: true,
      sector: 'gallery',
      status: 'trial',
      message: 'Pro plana yükselterek tüm özelliklere erişin!',
      dataPreserved: true,
      plans: [...] // Plan listesi
    });
  };

  return (
    <div className="p-6">
      {/* Trial Uyarısı */}
      <TrialWarningBanner 
        sectorId="gallery" 
        onUpgrade={handleUpgrade}
      />

      {/* İçerik */}
      <h1>Araç Listesi</h1>
      {/* ... */}
    </div>
  );
};

export default GalleryDashboard;
```

---

## 🔄 402 Error Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        402 PAYMENT REQUIRED FLOW                 │
└─────────────────────────────────────────────────────────────────┘

1. Kullanıcı /api/v1/gallery/cars isteği yapar
                    │
                    ▼
2. subscription_middleware kontrolü
   ├── User authenticated? ✓
   ├── Org access? ✓
   ├── Sector access? ✓
   └── Subscription active?
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
    ACTIVE/TRIAL              EXPIRED/LOCKED
       │                         │
       ▼                         ▼
   Return data            402 Payment Required
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
              Response JSON:            Frontend Axios
              {                         Interceptor
                "error": "payment_required",    │
                "code": "SUBSCRIPTION_EXPIRED", │
                "message": "...",               │
                "data_preserved": true,         │
                "plans": [...]                  │
              }                                 │
                                               │
                                               ▼
                                        PaywallOverlay
                                        açılır (blur bg)
                                               │
                                               ▼
                                        Kullanıcı plan
                                        seçer ve ödeme
                                        yapar
                                               │
                                               ▼
                                        ✅ Erişim açılır

NOT: VERİLER ASLA SİLİNMEZ - SADECE ERİŞİM KİLİTLENİR
```

---

## 📊 Database Schema

```javascript
// MongoDB Collections

// 1. users (Global - SSO)
{
  id: "uuid",
  email: "user@example.com",
  password_hash: "...",
  full_name: "John Doe",
  auth_provider: "email|google|apple",
  is_active: true,
  created_at: ISODate()
}

// 2. organizations
{
  id: "uuid",
  name: "Aslanbaş Oto",
  slug: "aslanbas-oto",
  owner_id: "user_uuid",
  is_active: true
}

// 3. user_sectors (Multi-tenancy ilişkisi)
{
  id: "uuid",
  user_id: "user_uuid",
  organization_id: "org_uuid",
  sector_id: "gallery",
  role: "admin|manager|editor|viewer",
  is_active: true
}

// 4. subscriptions
{
  id: "uuid",
  organization_id: "org_uuid",
  sector_id: "gallery",
  plan_id: "plan_uuid",
  status: "trial|active|expired|locked|cancelled",
  trial_start: ISODate(),
  trial_end: ISODate(),
  current_period_start: ISODate(),
  current_period_end: ISODate(),
  locked_at: ISODate(),  // ⚠️ Kilitlenme zamanı
  lock_reason: "payment_required"
}

// 5. Sektör-spesifik tablolar
// ⚠️ Her zaman organization_id ve sector_id ile filtrelenmeli!
{
  id: "uuid",
  organization_id: "org_uuid",  // 🔒 Tenant isolation
  sector_id: "gallery",
  // ... sektöre özel alanlar
}
```

---

## ✅ Checklist

### Backend
- [ ] `database_models.py` dosyasını `/backend/models/` altına kopyala
- [ ] `subscription_middleware.py` dosyasını `/backend/middleware/` altına kopyala
- [ ] Her sektör router'ına `subscription_middleware` dependency'sini ekle
- [ ] Multi-tenancy için her sorguya `get_tenant_filter()` ekle
- [ ] MongoDB index'lerini oluştur

### Frontend
- [ ] `apiMultiTenant.js` dosyasını `/frontend/src/services/` altına kopyala
- [ ] `PaywallOverlay.jsx` dosyasını `/frontend/src/components/` altına kopyala
- [ ] `TrialWarningBanner.jsx` dosyasını `/frontend/src/components/` altına kopyala
- [ ] `useSubscription.js` dosyasını `/frontend/src/hooks/` altına kopyala
- [ ] `App.js`'e `PaywallProvider` ekle
- [ ] Sayfalara `TrialWarningBanner` ekle

### Test
- [ ] Trial otomatik başlatma testi
- [ ] 402 hatası ve paywall görüntüleme testi
- [ ] Ödeme sonrası erişim testi
- [ ] Multi-tenancy veri izolasyonu testi
