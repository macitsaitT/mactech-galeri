# MACTech Merkezi Mimari Tasarımı

## 🏗️ Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MACTECH PLATFORM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Website    │  │  Galeri Web  │  │ Galeri Mobil │  │  Emlak Web   │    │
│  │  (Tanıtım)   │  │    (CRM)     │  │    (App)     │  │   (Gelecek)  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └────────────────┬┴─────────────────┴─────────────────┘             │
│                          │                                                   │
│                          ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MERKEZI API GATEWAY                               │   │
│  │                    /api/v1/{sector}/...                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Auth Middleware → Org Middleware → Sector Middleware → Subscription │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                   │
│         ┌────────────────┼────────────────┐                                 │
│         ▼                ▼                ▼                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                            │
│  │   Global   │  │  Sektör    │  │ Abonelik   │                            │
│  │   Users    │  │  Modules   │  │  Billing   │                            │
│  └────────────┘  └────────────┘  └────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 ER DİYAGRAMI (Veritabanı Şeması)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL TABLES (Merkezi)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│       USERS         │       │    ORGANIZATIONS    │
├─────────────────────┤       ├─────────────────────┤
│ id (UUID) PK        │───┐   │ id (UUID) PK        │
│ email (unique)      │   │   │ owner_id FK ────────│───┐
│ password_hash       │   │   │ name                │   │
│ full_name           │   │   │ logo_url            │   │
│ phone               │   │   │ address             │   │
│ avatar_url          │   └───│ created_at          │   │
│ auth_provider       │       │ updated_at          │   │
│ email_verified      │       └─────────┬───────────┘   │
│ created_at          │                 │               │
│ last_login          │                 │               │
└─────────────────────┘                 │               │
                                        │               │
┌─────────────────────┐                 │               │
│    ORG_MEMBERS      │                 │               │
├─────────────────────┤                 │               │
│ id (UUID) PK        │                 │               │
│ org_id FK ──────────│─────────────────┘               │
│ user_id FK ─────────│─────────────────────────────────┘
│ role (enum)         │   [admin, manager, editor, viewer]
│ invited_by          │
│ invited_at          │
│ accepted_at         │
└─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECTOR & SUBSCRIPTION TABLES                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│      SECTORS        │       │        PLANS        │
├─────────────────────┤       ├─────────────────────┤
│ id (string) PK      │───┐   │ id (UUID) PK        │
│ [gallery, realestate│   │   │ sector_id FK ───────│───┐
│  logistics, etc.]   │   │   │ name                │   │
│ name                │   │   │ [Free, Pro, Enter.] │   │
│ description         │   │   │ price_monthly       │   │
│ icon                │   │   │ price_yearly        │   │
│ is_active           │   │   │ trial_days (14)     │   │
│ created_at          │   │   │ features (JSON)     │   │
└─────────────────────┘   │   │ limits (JSON)       │   │
                          │   └─────────────────────┘   │
                          │                             │
┌─────────────────────┐   │   ┌─────────────────────┐   │
│   ORG_SECTORS       │   │   │   SUBSCRIPTIONS     │   │
├─────────────────────┤   │   ├─────────────────────┤   │
│ id (UUID) PK        │   │   │ id (UUID) PK        │   │
│ org_id FK           │   │   │ org_id FK           │   │
│ sector_id FK ───────│───┘   │ sector_id FK        │   │
│ status (enum)       │       │ plan_id FK ─────────│───┘
│ [trial, active,     │       │ status (enum)       │
│  expired, blocked]  │       │ [active, cancelled, │
│ trial_start_date    │       │  past_due, expired] │
│ trial_end_date      │       │ current_period_start│
│ first_access_date   │       │ current_period_end  │
│ created_at          │       │ cancel_at_period_end│
└─────────────────────┘       │ stripe_customer_id  │
                              │ stripe_subscription │
                              │ created_at          │
                              └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECTOR-SPECIFIC TABLES (Modüler)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ GALLERY SECTOR ─────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   GALLERY_CARS      │  │ GALLERY_CUSTOMERS   │  │GALLERY_TRANSACTIONS │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│  │ id (UUID) PK        │  │ id (UUID) PK        │  │ id (UUID) PK        │  │
│  │ org_id FK           │  │ org_id FK           │  │ org_id FK           │  │
│  │ brand               │  │ name                │  │ type                │  │
│  │ model               │  │ phone               │  │ amount              │  │
│  │ year                │  │ email               │  │ description         │  │
│  │ price               │  │ ...                 │  │ ...                 │  │
│  │ status              │  │                     │  │                     │  │
│  │ ...                 │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ REALESTATE SECTOR (Gelecek) ────────────────────────────────────────────────┐
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │REALESTATE_PROPERTIES│  │ REALESTATE_CLIENTS  │  │ REALESTATE_DEALS    │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│  │ id (UUID) PK        │  │ id (UUID) PK        │  │ id (UUID) PK        │  │
│  │ org_id FK           │  │ org_id FK           │  │ org_id FK           │  │
│  │ type (sale/rent)    │  │ name                │  │ property_id FK      │  │
│  │ address             │  │ phone               │  │ client_id FK        │  │
│  │ price               │  │ budget              │  │ status              │  │
│  │ sqm                 │  │ ...                 │  │ ...                 │  │
│  │ ...                 │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ LOGISTICS SECTOR (Gelecek) ─────────────────────────────────────────────────┐
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │LOGISTICS_SHIPMENTS  │  │ LOGISTICS_VEHICLES  │  │ LOGISTICS_ROUTES    │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 İLİŞKİLER

```
USER (1) ────────────── (N) ORGANIZATION (owner olarak)
USER (1) ────────────── (N) ORG_MEMBER (üye olarak)
ORGANIZATION (1) ────── (N) ORG_MEMBER
ORGANIZATION (1) ────── (N) ORG_SECTOR
ORGANIZATION (1) ────── (N) SUBSCRIPTION
SECTOR (1) ───────────── (N) ORG_SECTOR
SECTOR (1) ───────────── (N) PLAN
SECTOR (1) ───────────── (N) SUBSCRIPTION
PLAN (1) ─────────────── (N) SUBSCRIPTION
ORGANIZATION (1) ────── (N) GALLERY_* (sektör tabloları)
ORGANIZATION (1) ────── (N) REALESTATE_* (sektör tabloları)
```

---

## 🛣️ API ENDPOINT YAPISI

```
/api/v1/
│
├── auth/
│   ├── POST   /register          # Yeni kullanıcı kaydı
│   ├── POST   /login             # Giriş
│   ├── POST   /google            # Google OAuth
│   ├── POST   /refresh           # Token yenileme
│   ├── GET    /me                # Mevcut kullanıcı bilgisi
│   └── POST   /logout            # Çıkış
│
├── organizations/
│   ├── GET    /                  # Kullanıcının organizasyonları
│   ├── POST   /                  # Yeni organizasyon oluştur
│   ├── GET    /:org_id           # Organizasyon detayı
│   ├── PUT    /:org_id           # Organizasyon güncelle
│   ├── GET    /:org_id/members   # Üyeler
│   ├── POST   /:org_id/members   # Üye davet et
│   └── GET    /:org_id/sectors   # Aktif sektörler
│
├── subscriptions/
│   ├── GET    /plans             # Tüm planlar
│   ├── GET    /plans/:sector_id  # Sektör planları
│   ├── POST   /checkout          # Ödeme başlat (Stripe)
│   ├── POST   /webhook           # Stripe webhook
│   ├── GET    /status/:sector_id # Abonelik durumu
│   └── POST   /cancel            # İptal
│
├── {sector_name}/                 # DİNAMİK SEKTÖR ROUTING
│   │
│   ├── gallery/
│   │   ├── GET    /cars          # Araçlar
│   │   ├── POST   /cars          # Araç ekle
│   │   ├── GET    /customers     # Müşteriler
│   │   ├── GET    /transactions  # İşlemler
│   │   └── ...
│   │
│   ├── realestate/
│   │   ├── GET    /properties    # Emlaklar
│   │   ├── GET    /clients       # Müşteriler
│   │   └── ...
│   │
│   └── logistics/
│       ├── GET    /shipments     # Gönderiler
│       └── ...
```

---

## 🔐 MİDDLEWARE ZİNCİRİ

```
Request
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. AUTH MIDDLEWARE                                               │
│    - JWT Token doğrulama                                        │
│    - user_id çıkarma                                            │
│    - Token expired → 401 Unauthorized                           │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ORG MIDDLEWARE                                                │
│    - Header'dan X-Org-ID veya query'den org_id alma             │
│    - Kullanıcının bu org'a erişimi var mı?                      │
│    - Erişim yok → 403 Forbidden                                 │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SECTOR MIDDLEWARE                                             │
│    - URL'den sector_name çıkarma (/api/v1/gallery/...)          │
│    - Sektör aktif mi?                                           │
│    - org_sectors tablosunda kayıt var mı?                       │
│    - Yoksa → İlk erişim, 14 gün deneme başlat                   │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SUBSCRIPTION MIDDLEWARE (PAYWALL)                             │
│    - Deneme süresi aktif mi? → Geç                              │
│    - Aktif abonelik var mı? → Geç                               │
│    - Süre dolmuş → 402 Payment Required + paywall_data          │
│                                                                  │
│    Response: {                                                   │
│      "error": "subscription_required",                          │
│      "sector": "gallery",                                       │
│      "trial_ended_at": "2024-01-15",                           │
│      "plans": [...],                                            │
│      "checkout_url": "/subscribe/gallery"                       │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PERMISSION MIDDLEWARE (Opsiyonel)                             │
│    - Kullanıcı rolü bu endpoint'e erişebilir mi?                │
│    - admin, manager, editor, viewer                             │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
 Route Handler (İş Mantığı)
```

---

## 💳 14 GÜNLÜK DENEME & ABONELİK AKIŞI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DENEME SÜRESİ AKIŞI                                │
└─────────────────────────────────────────────────────────────────────────────┘

Kullanıcı ilk kez /api/v1/gallery/* endpoint'ine istek atıyor
                          │
                          ▼
              ┌───────────────────────┐
              │ org_sectors tablosunda │
              │ kayıt var mı?          │
              └───────────┬───────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
        HAYIR                          EVET
           │                             │
           ▼                             ▼
    ┌─────────────────┐         ┌─────────────────┐
    │ Yeni kayıt oluş-│         │ Status kontrol  │
    │ tur:            │         │                 │
    │ status: 'trial' │         └────────┬────────┘
    │ trial_start:now │                  │
    │ trial_end:+14gün│         ┌────────┴────────┐
    └────────┬────────┘         │                 │
             │                  ▼                 ▼
             │            status='trial'    status='active'
             │                  │                 │
             │                  ▼                 ▼
             │         trial_end > now?     ✅ Erişim Ver
             │                  │
             │         ┌───────┴───────┐
             │         │               │
             │         ▼               ▼
             │       EVET            HAYIR
             │         │               │
             │         ▼               ▼
             │    ✅ Erişim Ver   ❌ PAYWALL
             │                    status='expired'
             │                    402 Response
             │
             ▼
       ✅ Deneme Başladı
       (14 gün erişim)


┌─────────────────────────────────────────────────────────────────────────────┐
│                           ABONELİK AKIŞI                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Kullanıcı Plan Seçiyor (Pro/Enterprise)
                │
                ▼
    ┌───────────────────────┐
    │ POST /subscriptions/  │
    │      checkout         │
    │ {sector, plan, period}│
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Stripe Checkout       │
    │ Session oluştur       │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Kullanıcı ödeme yapar │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Stripe Webhook        │
    │ checkout.completed    │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ subscriptions tablosu │
    │ güncelle:             │
    │ status: 'active'      │
    │ plan_id: selected     │
    │ stripe_subscription_id│
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ org_sectors tablosu   │
    │ güncelle:             │
    │ status: 'active'      │
    └───────────────────────┘
                │
                ▼
         ✅ Tüm Platformlarda
            Anında Aktif
         (Web + Mobil)
```

---

## 🔄 PLATFORM SENKRONIZASYONU

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEK BACKEND - ÇOK PLATFORM                   │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
     │   Website    │    │  Galeri Web  │    │ Galeri Mobil │
     │   (React)    │    │   (React)    │    │   (Expo)     │
     └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
            │                   │                   │
            │    JWT Token      │    JWT Token      │    JWT Token
            │    X-Org-ID       │    X-Org-ID       │    X-Org-ID
            │                   │                   │
            └───────────────────┴───────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    MERKEZI BACKEND    │
                    │      (FastAPI)        │
                    │                       │
                    │  • Auth Servisi       │
                    │  • Subscription       │
                    │  • Sector Modules     │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │      MongoDB          │
                    │                       │
                    │  • users              │
                    │  • organizations      │
                    │  • subscriptions      │
                    │  • gallery_*          │
                    │  • realestate_*       │
                    └───────────────────────┘

Abonelik değiştiğinde:
1. Backend'de subscriptions tablosu güncellenir
2. Tüm platformlar aynı API'yi çağırdığı için
3. Anında tüm cihazlarda aktif olur!
```
