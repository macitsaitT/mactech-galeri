# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 5.4.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete - Google Auth Active, Notifications Active

## Implementation Status

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
