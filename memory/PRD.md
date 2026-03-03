# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 3.0.0
- **Last Updated:** 2026-03-04
- **Status:** MVP Complete + Kullanıcı Yönetimi Aktif

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Core Requirements & Implementation Status

### Dashboard
- [x] Stat kartları, Quick Actions, Son İşlemler, Stok Durumu, Raporlar
- [x] Recharts grafikleri (Gelir/Gider, Araç Dağılımı, Satış Trendi, Marka Sıralaması)

### Araç Yönetimi
- [x] 4 Sekmeli Form (Genel, Ekspertiz, Fotoğraf, Sahiplik)
- [x] Zincirleme dropdown: Marka -> Model -> Motor -> Paket
- [x] Ekspertiz diagram, fotoğraf yükleme, konsinye/stok
- [x] Çift satış engelleme
- [x] Satış/Kapora iptalinde araç durumu otomatik geri dönüşü
- [x] **Detay Görüntüle Modal** (VehicleDetailModal) - tüm araç bilgileri, fotoğraflar, ekspertiz
- [x] **Masraflar Modal** (VehicleExpensesModal) - araca ait masraflar ve yeni masraf ekleme
- [x] PWA manifest, logo entegrasyonu

### Finans Yönetimi
- [x] Gelir/Gider takibi, filtreleme, arama
- [x] İşlem İptal / Kalıcı Silme
- [x] **Word Export** (Excel'den Word'e çevrildi)

### Kullanıcı Yönetimi & Yetki Sistemi (YENİ v3.0)
- [x] **3 Rol:** Admin, Muhasebe, Satış Elemanı
- [x] **Admin:** Tam yetki (her şeyi görebilir/yapabilir + kullanıcı yönetimi)
- [x] **Muhasebe:** Dashboard, Gelir&Gider, Raporlar, Müşteriler
- [x] **Satış Elemanı:** Dashboard, Stok/Konsinye/Satılan Araçlar, Müşteriler, Randevular
- [x] Rol tabanlı sidebar ve bottom nav filtreleme
- [x] Kullanıcılar sayfası (CRUD) - sadece admin erişebilir
- [x] **Çalışan Payı → Kişi Seçimi** - satışta hangi çalışanın payı olduğu seçilebilir

### Raporlama & PDF
- [x] Rapor Oluşturucu Modal, PDF/Yazdır düzeni
- [x] Tanıtım Kartı, Ekspertiz PDF

### Logo Yönetimi
- [x] Ayarlar'da logo yükleme/silme/önizleme
- [x] PDF çıktılarında transparent watermark

### Diğer
- [x] JWT auth, dark theme, KVKK silme, şifreleme, PWA, takvim
- [x] **Word export** (araçlar, müşteriler, işlemler)
- [x] Tüm modallar viewport ortasında, canlı saat, bildirim zili, responsive mobil

## API Endpoints
```
POST /api/auth/register, /api/auth/login
GET /api/auth/me, PUT /api/auth/profile, DELETE /api/auth/delete-account
CRUD: /api/cars, /api/customers, /api/transactions, /api/appointments
PATCH /api/cars/{car_id}
GET /api/stats
POST /api/upload, GET /api/files/{path}
GET /api/export/cars, /api/export/customers, /api/export/transactions (Word .docx)
GET /api/export/expertise/{car_id} (PDF)
GET /api/users, POST /api/users, PUT /api/users/{id}, DELETE /api/users/{id}
GET /api/employees
```

## Test Credentials
- test@test.com / password

## Prioritized Backlog
### P1 - Next
- [ ] Real email verification (MOCKED currently)
- [ ] Capacitor native build for app stores

### P2
- [ ] Google Social Login (MOCKED currently)
- [ ] Backend refactoring (server.py -> routes/models/services)
- [ ] AppContext splitting (VehicleContext, FinanceContext)

### P3
- [ ] AI vehicle valuation
- [ ] Push notifications (real service)

## Mocked Services
- Email sending (verification & reminders)
- Google Authentication

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts, react-big-calendar
- Backend: FastAPI, Python, MongoDB (motor), Pydantic, reportlab, python-docx
- Storage: Emergent Object Storage
- Architecture: SPA + RESTful API, PWA configured

## DB Schema
- **users:** `{ id, email, password_hash, company_name, phone, role: (admin|muhasebe|satis), logo_url, theme }`
- **cars:** `{ id, brand, model, year, plate, status, expertise, photos, user_id ... }`
- **customers:** `{ id, name, phone, type, notes, user_id ... }`
- **transactions:** `{ id, type, category, amount, date, car_id, employee_name, user_id ... }`
- **appointments:** `{ id, title, date, time, status, user_id ... }`
