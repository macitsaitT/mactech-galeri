# MACTech Oto Galeri CRM - PRD

## Project Overview
- **Project Name:** MACTech Oto Galeri CRM
- **Version:** 5.8.0
- **Last Updated:** 2026-02-25
- **Status:** Vadeli Satış + WhatsApp Paylaşım + Net Kâr Optimizasyon

## Implementation Status

### v5.8.0 - Çoklu Özellik Paketi (2026-02-25)
- [x] **Bug Fix (P0)**: Satış onaylanıp ekrandan çıkmıyordu — App.js modal kapatma çağrısı kaldırıldı, SaleModal kendi flow'unu yönetiyor (Satış Tamamlandı → WhatsApp gönder → kapat). Hata varsa `throw error` ile SaleModal başarısız ekranına geçmiyor.
- [x] **Bug Fix (P0)**: Düzenleme'de çalışan payı yoktu — `Sale Info` tab'ı her zaman görünür yapıldı (satılmamış araçlarda "Çalışan Payı / Satışı Yapan" planlama, satılmış araçta düzenleme). Backend `patch_car`'da `employee_share` değişirse ilgili "Çalışan Payı" tx'i + kasa otomatik senkronize ediliyor.
- [x] **Net Kâr** kartı düzeltmesi: artık `totalIncome - totalExpense` değil; sadece **satılan araç başı kar** (sale_price − purchase_price − araca-bağlı giderler), `Math.max(0, ...)` ile asla eksiye düşmüyor. İşletme giderleri (kira, maaş, fatura) yansımıyor.
- [x] **Vadeli Satış / Borç Takibi (P0)**: Yeni `installments` koleksiyonu, `routes/installments.py`. Müşteri kartında **Vadeli Satışlar** drawer + `InstallmentModal` (create/detail). Ödemeler `transactions` üzerinden (`category=Taksit Ödemesi`, `installment_id` referansı) → kasa otomatik senkron.
- [x] **PDF Yazdırma**: `utils/installmentPdf.js` jsPDF ile borç senedi/ekstre çıktısı (özet, ödeme tablosu, imza alanları).
- [x] **WhatsApp Paylaşım Kartı (P1)**: `ShareCardModal` + html2canvas ile fotoğraf + temel özellikleri olan zarif JPG kartı. Araç dropdown'da "WhatsApp Paylaş" → görseli indir + wa.me metin açar. Native Web Share API desteği var.

### v5.7.0 - Kasa Sistemi + Muayene Bildirim Fix
- Kasa/Sermaye sistemi (atomik), Dashboard kartı, CapitalModal
- Muayene tarihi değişince bildirim auto-temizleme

### v5.6.0 - Satış Akışı + Tam Katalog (73 marka)
### v5.5.0 - JSON tabanlı katalog
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
