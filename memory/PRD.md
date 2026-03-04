# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 4.3.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete + Multi-Tenant RBAC + Salesperson Tracking + Report Employee Filter

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Implementation Status

### v4.3 - Rapor Çalışan Filtresi
- [x] Rapor modalına çalışan filtresi eklendi (admin/muhasebe için)
- [x] Seçili çalışana göre işlemler filtreleniyor (created_by)
- [x] Rapor başlığında seçili çalışan adı gösterimi
- [x] Yazdırma/PDF çıktısında çalışan adı başlığa ekleniyor

### v4.2 - Satış Elemanı Takibi
- [x] Araç satıldığında satan kişi otomatik olarak kaydedilir (sold_by_name, sold_by_user_id)
- [x] Araç kartında "Satan: [isim]" bilgisi gösterimi
- [x] Araç detay modalında "Satan Kişi" satırı
- [x] Satış Raporu'nda "Satış Elemanı" sütunu
- [x] Satış iptalinde satan kişi bilgileri otomatik temizleme
- [x] Yazdırma/PDF çıktısında da Satış Elemanı sütunu

### v4.1 - Kapora Müşteri Takibi
- [x] Kapora alırken müşteri seçimi (mevcut müşteri veya yeni müşteri ekleme)
- [x] Araç kartında kapora bilgisi: tutar + müşteri adı + tarih
- [x] Araç detay modalında kapora bilgisi bölümü
- [x] Kapora iadesi'nde müşteri bilgileri otomatik temizleme
- [x] Transaction'a müşteri adı yazılması

### v4.0 - Organizasyon Tabanlı Çoklu Kullanıcı
- [x] Her yeni kayıt = Admin, kendi org_id
- [x] Admin: Muhasebe/Satış Elemanı/Admin ekleyebilir
- [x] Veri İzolasyonu: farklı admin'lerin verileri karışmaz
- [x] Satış Elemanı: sadece kendi verilerini görür
- [x] Muhasebe: tüm org verilerini görür + kişi filtresi
- [x] Rol tabanlı sidebar/bottom nav filtreleme

### Tamamlanan Diğer Özellikler
- [x] Dashboard, Araç/Müşteri/İşlem CRUD, JWT auth
- [x] Ekspertiz diagram, fotoğraf yükleme, PWA
- [x] Word export (.docx), Logo watermark, Tanıtım Kartı
- [x] Detay Görüntüle & Masraflar modalları
- [x] Çalışan payı kişi seçimi
- [x] "Made with Emergent" rozeti kaldırıldı

## DB Schema (Updated)
- **users:** `{ id, email, password_hash, company_name, phone, role, org_id, logo_url, theme }`
- **cars:** `{ id, brand, model, year, plate, status, deposit_amount, deposit_customer_id, deposit_customer_name, deposit_date, sold_by_user_id, sold_by_name, org_id, created_by, ... }`
- **customers:** `{ id, name, phone, type, notes, org_id, created_by, ... }`
- **transactions:** `{ id, type, category, amount, date, car_id, employee_name, org_id, created_by, ... }`

## Test Credentials
- Admin: test@test.com / password
- Satış: satis@test.com / password
- Muhasebe: muhasebe@test.com / password

## Prioritized Backlog
### P1
- [ ] Real email verification (MOCKED)
- [ ] Capacitor native build

### P2
- [ ] Google Social Login (MOCKED)
- [ ] Backend refactoring (server.py -> modular)

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
