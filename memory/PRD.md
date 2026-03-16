# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 5.1.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete + Backend Modular + Security Hardening

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Implementation Status

### v5.1.0 - Security Hardening
- [x] Rate Limiting: Login (10/dk), Register (5/dk) - slowapi
- [x] Input Validation: Email format/normalizasyon, şifre politikası (min 8 karakter)
- [x] MongoDB Injection Koruması: $ operatör engelleme, input sanitization
- [x] File Upload Güvenliği: Magic bytes doğrulama (extension + içerik eşleşmesi)
- [x] Security Headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- [x] Hassas Veri Koruması: password_hash, verification_code API response'lardan çıkarıldı
- [x] 26/26 güvenlik + regresyon testi başarılı

### v5.0.0 - Backend Modular Refactoring
- [x] Monolitik server.py (1453 satır) -> modüler yapıya geçirildi (113 satır entry point)
- [x] Route modülleri: auth_routes, cars, customers, transactions, appointments, users, stats, uploads, exports, encryption_routes
- [x] Helper modülleri: db.py, auth.py, models.py, helpers.py, encryption.py, storage.py, security.py
- [x] 51/51 backend testi başarılı

### v4.10.0 - Tanıtım Kartı Düzeltmesi + Deploy Desteği
- [x] Tanıtım kartında her zaman galeri sahibi (admin) adı gösteriliyor
- [x] /api/org/owner endpoint eklendi
- [x] requirements.txt temizlendi (Railway deploy düzeltmesi)

### v4.9.x - Rapor Optimizasyonları
- [x] Mobilde kart düzeni, kompakt filtre, bölüm ayrıştırma
- [x] İşletme/Araç rapor ayrımı, kâr/zarar raporu

### v4.8.0 - Telefon Formatı + Müşteri Temizleme
- [x] 0XXX XXX XX XX formatı, satış iptali/silme müşteri temizleme

### v4.7.x - Yetki Yönetimi + Satış Butonu Fix
- [x] 21 farklı yetki, rol bazlı toggle yönetimi
- [x] SaleModal buton düzeltmesi

### v4.0-4.6 - Temel Özellikler
- [x] Multi-tenant architecture, RBAC, dashboard, stok gün sayısı
- [x] Çöp kutusu, satış elemanı takibi, kapora müşteri takibi

### Tamamlanan Diğer Özellikler
- [x] Araç/Müşteri/İşlem CRUD, JWT auth, ekspertiz diagram, PWA
- [x] Word/PDF export, logo watermark, tanıtım kartı

## Code Architecture (v5.1)
```
/app/backend/
├── server.py          # Entry point (rate limiter, security middleware, CORS, startup)
├── db.py              # MongoDB connection
├── auth.py            # JWT auth (hash, verify, create_token, get_current_user)
├── models.py          # Pydantic models
├── helpers.py         # build_data_filter (org_id isolation)
├── encryption.py      # Fernet encryption
├── storage.py         # Emergent Object Storage
├── security.py        # NEW: validation, sanitization, magic bytes, security headers
└── routes/
    ├── auth_routes.py       # register(rate limited), login(rate limited), verify, profile
    ├── cars.py, customers.py, transactions.py, appointments.py
    ├── users.py             # User management + permissions
    ├── stats.py, uploads.py, exports.py, encryption_routes.py
```

## DB Schema
- **users:** `{ id, email, password_hash, company_name, phone, role, org_id, logo_url, theme }`
- **cars:** `{ id, brand, model, year, plate, status, org_id, created_by, deleted, ... }`
- **customers:** `{ id, name, phone, type, notes, org_id, created_by, deleted, ... }`
- **transactions:** `{ id, type, category, amount, date, car_id, org_id, created_by, deleted, ... }`
- **permissions:** `{ org_id, role_defaults, user_overrides }`

## Prioritized Backlog
### P1
- [ ] Real email verification (MOCKED)
- [ ] Capacitor native build

### P2
- [ ] Google Social Login (MOCKED)

### P3
- [ ] AI vehicle valuation
- [ ] Push notifications
- [ ] Sales performance reports

## Mocked Services
- Email sending (verification & reminders)
- Google Authentication

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts
- Backend: FastAPI, Python, MongoDB (motor), python-docx, reportlab, slowapi
- Storage: Emergent Object Storage
