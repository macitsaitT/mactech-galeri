# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 5.3.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete

## Implementation Status

### v5.3.0 - İndirme & Fotoğraf Düzeltmeleri
- [x] Fotoğraf yükleme fix: Content-Type header düzeltmesi (multipart boundary sorunu)
- [x] İndirme bildirimi: "İndirildi!" yeşil onay mesajı (4sn süre, tüm export butonları)
- [x] about:blank fix: Rapor yazdırma blob URL ile (ReportModal)
- [x] Ortak downloadBlob utility (helpers.js) - tüm sayfalarda tekrar eden kod kaldırıldı
- [x] iOS Safari desteği: Web Share API ile dosya paylaşımı

### v5.2.0 - Yıl Sonu Devri
- [x] Backend/Frontend: Yıl sonu kasa devri, transfer geçmişi, mükerrer engeli

### v5.1.0 - Security Hardening  
- [x] Rate Limiting, Input Validation, MongoDB Injection, Security Headers

### v5.0.0 - Backend Modular Refactoring
- [x] Monolithic -> modular backend (113 lines entry point)

## Code Architecture
```
/app/backend/
├── server.py, db.py, auth.py, models.py, helpers.py, encryption.py, storage.py, security.py
└── routes/ (auth_routes, cars, customers, transactions, appointments, users, stats, uploads, exports, encryption_routes, year_end)

/app/frontend/src/
├── utils/helpers.js        # downloadBlob, openPrintableHTML (shared)
├── utils/notifications.js  # Browser push notifications for appointments
├── pages/ (Dashboard, Inventory, Finance, Customers, Settings, Permissions, YearEndTransfer)
├── components/ (layout, modals, vehicles, ui)
└── services/api.js
```

## Bildirim Sistemi
- **Ne yapar:** Yaklaşan randevuları ve hatırlatıcıları browser push notification olarak gösterir
- **Nasıl çalışır:** App.js açılışında izin ister, randevuları kontrol eder, yaklaşan randevular için bildirim gönderir
- **Kapsam:** Sadece tarayıcı bildirimleri (push notification servisi yok)

## Prioritized Backlog
### P1
- [ ] Real email verification (MOCKED)
- [ ] Capacitor native build

### P2
- [ ] Google Social Login (MOCKED)

### P3
- [ ] AI vehicle valuation, Push notifications, Sales performance reports

## Mocked Services
- Email sending, Google Authentication
