# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 2.4.0
- **Last Updated:** 2026-02-27
- **Status:** MVP Complete - Tüm Özellikler Aktif

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
- [x] Çift satış engelleme (SaleModal guard + App.js guard)
- [x] Satış/Kapora iptalinde araç durumu otomatik geri dönüşü
- [x] Satılan araçlarda aksiyon menüsü: Satışı İptal Et, Düzenle, Detay, Ekspertiz PDF, Sil
- [x] PWA manifest: short_name="ASLANBAŞ", logo192/512 ikonları, favicon, theme_color
- [x] Logo entegrasyonu: Giriş ekranı (hero yerine), Sidebar header (sadece logo, yazı yok)

### Finans Yönetimi
- [x] Gelir/Gider takibi, filtreleme, arama
- [x] İşlem İptal (soft delete + araç durumu geri dönüşü)
- [x] İşlem Kalıcı Silme (hard delete + araç durumu geri dönüşü)
- [x] revertTransactionEffect: Satış, Kapora, Kapora Eklemesi, Kapora İadesi kategori bazlı geri alma

### Raporlama & PDF
- [x] Rapor Oluşturucu Modal, PDF/Yazdır düzeni, transparent logo watermark
- [x] Tanıtım Kartı: Beyaz arka planda görünür expertise diyagramı (TopDownDiagram SVG)

### Logo Yönetimi
- [x] Ayarlar'da logo yükleme/silme/önizleme
- [x] PDF çıktılarında transparent watermark

### Diğer
- [x] JWT auth, dark theme, KVKK silme, şifreleme, PWA, takvim, Excel/PDF export
- [x] Tüm modallar viewport ortasında, canlı saat, bildirim zili, responsive mobil

## API Endpoints
```
POST /api/auth/register, /api/auth/login
GET /api/auth/me, PUT /api/auth/profile, DELETE /api/auth/delete-account
CRUD: /api/cars, /api/customers, /api/transactions, /api/appointments
PATCH /api/cars/{car_id} (status updates)
GET /api/stats, POST /api/upload, GET /api/files/{path}
GET /api/export/cars, /api/export/customers, /api/export/transactions, /api/export/expertise/{car_id}
```

## Test Credentials
- test@test.com / password

## Prioritized Backlog
### P1 - Next
- [ ] Multi-user/Role Management (Admin, Satıcı)
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
- Backend: FastAPI, Python, MongoDB (motor), Pydantic, reportlab, openpyxl
- Storage: Emergent Object Storage
- Architecture: SPA + RESTful API, PWA configured
