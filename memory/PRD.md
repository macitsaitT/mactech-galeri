# MACTech Oto Galeri CRM - PRD

## Project Overview
- **Project Name:** MACTech Oto Galeri CRM
- **Version:** 5.7.0
- **Last Updated:** 2026-02-20
- **Status:** Capital/Kasa Sistemi Aktif — Tam Muhasebe Mode

## Implementation Status

### v5.7.0 - Kasa Sistemi + Muayene Bildirim Fix (2026-02-20)
- [x] **Kasa / Sermaye Sistemi (P0)**: MongoDB atomik `$inc` + koşullu filtre ile yarış-koşulsuz bakiye.
- [x] Yeni koleksiyonlar: `capital` (org_id bazlı tek doküman), `capital_movements` (denetim logu)
- [x] Yeni endpoint'ler: `GET /api/capital`, `POST /api/capital/adjust` (deposit/withdrawal), `POST /api/capital/set`, `GET /api/capital/movements`
- [x] `transactions` create/update/delete/restore akışları → kasa delta otomatik uygular (+income, −expense)
- [x] Expense sırasında bakiye yetersizse atomik 400 döner: `"Yetersiz sermaye! Mevcut: ₺X, Gerekli: ₺Y"`
- [x] Frontend: Dashboard tepe kartı (**Mevcut Sermaye**, altın gradient), `CapitalModal` 3 mod (Giriş / Çıkış / Bakiye Düzenle)
- [x] `AddCarModal`: Stok araç alışında yetersiz sermaye → araç kaydı rollback + uyarı
- [x] `AppContext`: `capital` state + `refreshCapital`, `adjustCapital`, `setCapitalAmount`
- [x] Eski `transactions` dokunulmaz (`capital_applied` flag), sadece yeni işlemler kasayı etkiler (3a)

- [x] **Muayene Bildirim Bug Fix**: Araç muayene/sigorta tarihi güncellendiğinde `notifications` ve tetiklenmiş `reminders` otomatik temizlenir (backend `patch_car` + `update_car`).
- [x] Bildirim "X" butonu artık soft-delete yerine bildirimi listeden tamamen kaldırır (yeni `DELETE /api/notifications/{id}`).

### v5.6.0 - Satış Akışı Sağlamlaştırma + Tam Katalog (2026-02-20)
- [x] Satış fiyatı düzenleme → `cars.sale_price` senkron
- [x] `SaleModal` araç giderleri özeti + detay
- [x] 73 marka / 741 model / 2543 motor / 2929 paket
- [x] `getGearsForSelection` akıllı vites filtreleme

### v5.5.0 - Kapsamlı Araç Veritabanı (2026-02-20)
- [x] JSON tabanlı katalog (carData.js → catalog/*.json)

### v5.4.0 - Google Social Login & Bildirim Sistemi Aktif
- [x] Google Social Login: Emergent Auth entegrasyonu (POST /api/auth/google)
- [x] Login sayfasında "Google ile Giriş Yap" butonu
- [x] OAuth callback handler (session_id extraction from URL hash)
- [x] Yeni Google kullanıcıları otomatik admin org oluşturma
- [x] Mevcut kullanıcılar Google ile giriş yapabilir
- [x] Bildirim sistemi: 5dk periyodik randevu kontrolü
- [x] Olay bazlı bildirimler: araç satışı, kapora, yeni müşteri, yeni randevu
- [x] Browser push notification (Notification API)
- [x] 29/30 test başarılı

### v5.3.0 - İndirme & Fotoğraf Düzeltmeleri
- [x] Fotoğraf yükleme Content-Type fix, about:blank fix, "İndirildi!" feedback

### v5.2.0 - Yıl Sonu Devri
- [x] Yıl sonu kasa devri, transfer geçmişi

### v5.1.0 - Security Hardening
- [x] Rate Limiting, Input Validation, Security Headers

### v5.0.0 - Backend Modular Refactoring
- [x] Monolithic -> modular backend

## Aktif Entegrasyonlar
- **Google Social Login**: auth.emergentagent.com üzerinden OAuth
- **Bildirim Sistemi**: Browser Notification API + periyodik randevu kontrolü
- **Emergent Object Storage**: Dosya/fotoğraf yükleme

## MOCK Olan Servisler
- **Email doğrulama**: Doğrulama kodu ekranda gösteriliyor (gerçek email gitmiyor)

## Email Doğrulama Aktifleştirme Rehberi
### Seçenek 1: Resend
1. https://resend.com adresine gidin, hesap oluşturun
2. Dashboard'dan API key alın
3. Backend .env'ye ekleyin: `RESEND_API_KEY=re_xxxxx`
4. Domain doğrulaması yapın (DNS kayıtları eklemeniz gerekir)

### Seçenek 2: SendGrid
1. https://sendgrid.com adresine gidin, hesap oluşturun
2. Settings > API Keys'den key oluşturun
3. Backend .env'ye ekleyin: `SENDGRID_API_KEY=SG.xxxxx`
4. Sender doğrulaması yapın

## Prioritized Backlog
### P1
- [ ] Email doğrulama aktifleştirme (Resend veya SendGrid API key gerekli)
- [ ] Capacitor native build

### P2
- [ ] Sales performance reports

### P3
- [ ] AI vehicle valuation, push notification service (FCM)

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts
- Backend: FastAPI, Python, MongoDB, slowapi, python-docx, reportlab
- Auth: JWT + Emergent Google OAuth
- Storage: Emergent Object Storage
