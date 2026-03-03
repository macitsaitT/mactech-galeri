# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 4.0.0
- **Last Updated:** 2026-03-04
- **Status:** MVP Complete + Organizasyon Tabanlı Çoklu Kullanıcı Sistemi Aktif

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Core Requirements & Implementation Status

### Organizasyon Tabanlı Çoklu Kullanıcı Sistemi (v4.0)
- [x] Her yeni kayıt = Admin, kendi org_id'si oluşturulur
- [x] Admin kullanıcı ekleyebilir (Muhasebe, Satış Elemanı, Admin)
- [x] **Veri İzolasyonu:** Farklı adminlerin verileri asla karışmaz
- [x] **Satış Elemanı:** Sadece kendi eklediği araçları/müşterileri/işlemleri görür
- [x] **Muhasebe:** Tüm organizasyon verilerini görür + kişiye özel filtreleme
- [x] **Admin:** Her şeyi görür + kullanıcı yönetimi
- [x] Rol tabanlı sidebar ve bottom nav filtreleme
- [x] Muhasebe/Admin raporlarında kişi filtresi dropdown'u
- [x] Çalışan payı → kişi seçimi (satışta hangi çalışanın payı olduğu)

### Dashboard
- [x] Stat kartları, Quick Actions, Son İşlemler, Stok Durumu
- [x] Recharts grafikleri (role göre filtrelenmiş veriler)

### Araç Yönetimi
- [x] 4 Sekmeli Form, Ekspertiz diagram, fotoğraf yükleme
- [x] **Detay Görüntüle Modal** (VehicleDetailModal)
- [x] **Masraflar Modal** (VehicleExpensesModal)
- [x] Çift satış engelleme, durum geri dönüşü

### Finans Yönetimi
- [x] Gelir/Gider takibi, filtreleme
- [x] **Word Export** (.docx formatında)
- [x] Kişi filtresi (muhasebe/admin için)

### Diğer Tamamlananlar
- [x] JWT auth, dark theme, PWA, takvim, müşteri yönetimi
- [x] Logo yönetimi, Tanıtım Kartı, Ekspertiz PDF
- [x] "Made with Emergent" rozeti kaldırıldı

## API Endpoints
```
POST /api/auth/register (yeni org oluşturur, admin rolü)
POST /api/auth/login (org_id, role token'da)
GET /api/auth/me, PUT /api/auth/profile
CRUD: /api/cars, /api/customers, /api/transactions, /api/appointments
GET /api/stats (role-based filtering)
GET /api/users, POST /api/users, PUT /api/users/{id}, DELETE /api/users/{id}
GET /api/employees, GET /api/org-users
GET /api/export/cars, /api/export/customers, /api/export/transactions (Word .docx)
POST /api/upload, GET /api/files/{path}
```

## Test Credentials
- Admin: test@test.com / password
- Satış: satis@test.com / password
- Muhasebe: muhasebe@test.com / password

## DB Schema
- **users:** `{ id, email, password_hash, company_name, phone, role: (admin|muhasebe|satis), org_id, logo_url, theme }`
- **cars:** `{ id, brand, model, year, plate, status, org_id, created_by, user_id, ... }`
- **customers:** `{ id, name, phone, type, notes, org_id, created_by, user_id, ... }`
- **transactions:** `{ id, type, category, amount, date, car_id, employee_name, org_id, created_by, user_id, ... }`
- **appointments:** `{ id, title, date, time, status, org_id, created_by, user_id, ... }`

## Prioritized Backlog
### P1
- [ ] Real email verification (MOCKED)
- [ ] Capacitor native build

### P2
- [ ] Google Social Login (MOCKED)
- [ ] Backend refactoring (server.py -> routes/models/services)

### P3
- [ ] AI vehicle valuation
- [ ] Push notifications

## Mocked Services
- Email sending (verification & reminders)
- Google Authentication

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts
- Backend: FastAPI, Python, MongoDB (motor), python-docx, reportlab
- Storage: Emergent Object Storage
- Architecture: SPA + RESTful API, PWA configured
