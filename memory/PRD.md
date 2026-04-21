# MACTech Oto Galeri CRM - PRD

## Project Overview
- **Project Name:** MACTech Oto Galeri CRM
- **Version:** 5.6.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete - Comprehensive Catalog + Sale Flow Hardening

## Implementation Status

### v5.6.0 - Satış Akışı Sağlamlaştırma + Tam Katalog (2026-02-20)
- [x] **Bug Fix (P0):** Satış fiyatı `EditTransactionModal` ile düzenlenince `cars.sale_price` ve `sold_date` de otomatik senkronize ediliyor (backend `update_transaction`). Artık Dashboard ve raporlarda güncel fiyat gözüküyor.
- [x] **Bug Fix (P0):** `SaleModal` özetinde aracın **birikmiş giderleri** (boya, lastik, bakım vb.) artık listeleniyor. Toplam net kar hesabından otomatik düşülüyor. "Detayları gör" ile kalemler açılabiliyor.
- [x] **Bug Fix (P0):** Özete **Alış Maliyeti** (stok araçlar için `purchase_price`) satırı eklendi — kar hesabı şeffaflaştı.
- [x] **Data (P1):** Katalog 48 → **73 marka** / 551 → **741 model** / 1965 → **2543 motor** / 2298 → **2929 paket** varyantına çıkarıldı.
- [x] Yeni eklenen markalar: Polestar, Zeekr, Lynk & Co, Leapmotor, Skywell, Hongqi, Nio, Karsan (Türk yerli), BMC, Ineos, DFSK, JAC.
- [x] Önceden boş olan 13 marka dolduruldu: Cadillac, Daewoo, Daihatsu, Infiniti, Iveco, Lada, Lancia, Lincoln, Lotus, Rolls-Royce, Rover, Saab, Smart.
- [x] Mevcut markalarda 30+ eksik model eklendi (Mercedes SLC/X/AMG One, Ford F-150/Edge/Escape, Volvo V70/XC70/S80, Renault Laguna/Grand Scenic, Hyundai Getz/ix35 vb.).
- [x] **Vites filtreleme:** `getGearsForSelection(brand, engine)` ile elektrik motor seçilince sadece elektrikli + otomatik; DSG/PDK/S-Tronic/Powershift/EDC marka-spesifik filtreleniyor.

### v5.5.0 - Kapsamlı Araç Veritabanı (2026-02-20)
- [x] `carData.js` → JSON tabanlı modüler yapıya taşındı
- [x] `/app/frontend/src/data/catalog/modelEngines.json` + `modelPackages.json`
- [x] `AddCarModal` dinamik filtreleme JSON verisiyle otomatik çalışır

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
