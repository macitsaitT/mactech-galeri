# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 5.0.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete + Backend Modular Refactoring Complete

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Implementation Status

### v5.0.0 - Backend Modular Refactoring
- [x] Monolitik server.py (1453 satır) -> modüler yapıya geçirildi (113 satır entry point)
- [x] Route modülleri: auth_routes, cars, customers, transactions, appointments, users, stats, uploads, exports, encryption_routes
- [x] Helper modülleri: db.py, auth.py, models.py, helpers.py, encryption.py, storage.py
- [x] 51/51 backend testi başarılı (CRUD, multi-tenancy, RBAC, exports, encryption)
- [x] Hiçbir özellik değişmedi - sadece yapısal refactoring

### v4.10.0 - Tanıtım Kartı Düzeltmesi + Deploy Desteği
- [x] Tanıtım kartında her zaman galeri sahibi (admin) adı gösteriliyor
- [x] /api/org/owner endpoint eklendi
- [x] requirements.txt temizlendi (Railway deploy düzeltmesi)

### v4.9.1 - Rapor Mobil Optimizasyonu
- [x] Mobilde kart düzeni (tablolar yerine) - tüm rapor tipleri için
- [x] Kompakt filtre alanı ve rapor butonları
- [x] Kâr/Zarar raporu mobil kart düzeni

### v4.9.0 - Rapor Ayrıştırma
- [x] İşletme raporu car_id bazlı filtreleme
- [x] Genel rapor iki ayrı bölüm: "Araç İşlemleri" ve "İşletme İşlemleri"

### v4.8.0 - Telefon Formatı + Müşteri Temizleme
- [x] Tüm telefon girişleri 0XXX XXX XX XX formatında
- [x] Satış iptali/araç silme sırasında bağlı müşteri soft-delete

### v4.7.1 - Satış Onay Butonu Düzeltmesi
- [x] SaleModal "Satışı Onayla" butonunun çalışmama hatası düzeltildi

### v4.7 - Yetki Yönetimi Paneli
- [x] Admin için Yetki Yönetimi sayfası (21 farklı yetki)
- [x] Muhasebe ve Satış Danışmanı rolleri için toggle bazlı izin yönetimi

### v4.6 - Stok Gün Sayısı + Kâr/Zarar Raporu
- [x] Araç kartında "Stokta X gün" gösterimi
- [x] Raporlara "Stok Araç Kâr/Zarar Raporu" tipi eklendi

### v4.5 - Tam Çöp Kutusu Desteği
- [x] İşlemler ve randevular soft-delete/restore desteği

### v4.4 - Dashboard Yeniden Tasarım
- [x] Tarih aralığı filtresi, dinamik bar chart

### v4.0 - Organizasyon Tabanlı Çoklu Kullanıcı
- [x] Multi-tenant architecture, RBAC

### Tamamlanan Diğer Özellikler
- [x] Dashboard, Araç/Müşteri/İşlem CRUD, JWT auth
- [x] Ekspertiz diagram, fotoğraf yükleme, PWA
- [x] Word export (.docx), Logo watermark, Tanıtım Kartı
- [x] Satış elemanı takibi, kapora müşteri takibi

## Code Architecture (v5.0)
```
/app/backend/
├── server.py          # Slim entry point (113 lines) - app, CORS, startup/shutdown
├── db.py              # MongoDB connection (client, db)
├── auth.py            # JWT auth (hash_password, verify_password, create_token, get_current_user)
├── models.py          # Pydantic models (User, Car, Customer, Transaction, Appointment)
├── helpers.py         # build_data_filter (org_id isolation)
├── encryption.py      # Fernet encryption (encrypt_value, decrypt_value)
├── storage.py         # Emergent Object Storage (init, put, get)
└── routes/
    ├── auth_routes.py       # register, login, verify-email, profile, org/owner
    ├── cars.py              # CRUD + patch + soft-delete/restore
    ├── customers.py         # CRUD + soft-delete/restore
    ├── transactions.py      # CRUD + soft-delete/restore
    ├── appointments.py      # CRUD + soft-delete/restore
    ├── users.py             # User management + permissions + employees
    ├── stats.py             # Dashboard statistics
    ├── uploads.py           # File upload/download
    ├── exports.py           # Word/PDF exports
    └── encryption_routes.py # Customer data encryption
```

## DB Schema
- **users:** `{ id, email, password_hash, company_name, phone, role, org_id, logo_url, theme }`
- **cars:** `{ id, brand, model, year, plate, status, deposit_amount, sold_by_user_id, sold_by_name, org_id, created_by, deleted, ... }`
- **customers:** `{ id, name, phone, type, notes, org_id, created_by, deleted, ... }`
- **transactions:** `{ id, type, category, amount, date, car_id, employee_name, org_id, created_by, deleted, ... }`
- **permissions:** `{ org_id, role_defaults, user_overrides }`

## Prioritized Backlog
### P1
- [ ] Security hardening / audit
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
- Backend: FastAPI, Python, MongoDB (motor), python-docx, reportlab
- Storage: Emergent Object Storage
