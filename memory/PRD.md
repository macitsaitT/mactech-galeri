# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 4.10.0
- **Last Updated:** 2026-03-16
- **Status:** MVP Complete + Promo Card Owner Fix + Deploy Support

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Implementation Status

### v4.10.0 - Tanıtım Kartı Düzeltmesi + Deploy Desteği
- [x] Tanıtım kartında her zaman galeri sahibi (admin) adı gösteriliyor
- [x] /api/org/owner endpoint eklendi - org admin bilgisini döndürür
- [x] Yazdırma/PDF çıktısı önizlemeyle birebir eşleştirildi (SVG legend eklendi)
- [x] requirements.txt temizlendi (emergentintegrations kaldırıldı - Railway deploy düzeltmesi)
- [x] Railway deploy rehberi verildi

### v4.9.1 - Rapor Mobil Optimizasyonu
- [x] Mobilde kart düzeni (tablolar yerine) - tüm rapor tipleri için
- [x] Kompakt filtre alanı ve rapor butonları
- [x] Bölüm başlıkları dikey yerleşim (Araç / İşletme)
- [x] Kâr/Zarar raporu mobil kart düzeni
- [x] İmza bölümü responsive (taşma düzeltildi)
- [x] Toplam kartları 3 sütun kompakt yerleşim
- [x] Görsel test: Genel, İşletme, scroll alt bölümler onaylandı

### v4.9.0 - Rapor Ayrıştırma
- [x] İşletme raporu artık car_id bazlı filtreleme yapıyor (araç işlemleri karışmıyor)
- [x] Genel rapor iki ayrı bölüm gösteriyor: "Araç İşlemleri" ve "İşletme İşlemleri"
- [x] Satış raporu Çalışan Payı ve Araç Sahibine Ödeme kategorilerini de içeriyor
- [x] Her bölümün kendi gelir/gider/net toplamları gösteriliyor
- [x] Test: Tüm rapor tipleri doğrulandı

### v4.8.0 - Telefon Formatı + Müşteri Temizleme
- [x] Tüm telefon girişleri 0XXX XXX XX XX formatında (11 hane, boşluklu)
- [x] formatPhoneInput fonksiyonu helpers.js'e eklendi (8 farklı bileşende uygulandı)
- [x] Satış iptali (handleCancelSale) sırasında bağlı müşteri de soft-delete edilir
- [x] Araç silme (handleDeleteCar) sırasında bağlı müşteri de soft-delete edilir
- [x] Test: Telefon formatı 4/4, müşteri temizleme kodu doğrulandı

### v4.7.1 - Satış Onay Butonu Düzeltmesi
- [x] SaleModal "Satışı Onayla" butonunun çalışmama hatası düzeltildi
- [x] Radix UI Dialog içinde form submit çakışması giderildi (type=submit -> type=button + onClick)
- [x] Test: 12/12 test başarılı, satış akışı tam çalışıyor

### v4.7 - Yetki Yönetimi Paneli
- [x] Admin için Yetki Yönetimi sayfası (21 farklı yetki)
- [x] Muhasebe ve Satış Danışmanı rolleri için toggle bazlı izin yönetimi
- [x] 5 yetki grubu: Araçlar, Müşteriler, Finansal İşlemler, Raporlar & Diğer, Randevular
- [x] Sidebar menü yetkilere göre dinamik filtreleme
- [x] Backend: permissions koleksiyonu, GET/PUT endpoint'leri
- [x] Varsayılana sıfırlama özelliği

### v4.6 - Stok Gün Sayısı + Kâr/Zarar Raporu
- [x] Araç kartında "Stokta X gün" gösterimi (entry_date'e göre hesaplama)
- [x] Araç detayında Giriş Tarihi, Eklenme Tarihi, Stokta kaç gün bilgisi
- [x] Satılan araçlarda "Stokta Kaldı X gün" gösterimi
- [x] Raporlara "Stok Araç Kâr/Zarar Raporu" tipi eklendi
- [x] Araç bazlı kâr/zarar tablosu (Alış, Giderler, Maliyet, Satış, Kâr/Zarar, Gün, Satan)
- [x] Toplam özet kartları (Toplam Alış, Satış, Giderler, Net Kâr/Zarar)

### v4.5 - Tam Çöp Kutusu Desteği
- [x] İşlemler (transactions) soft-delete ve restore desteği
- [x] Randevular (appointments) soft-delete ve restore desteği
- [x] Çöp sayfası: Tümü, Araçlar, İşlemler, Müşteriler, Randevular tab'ları
- [x] Her öğe tipi için geri yükleme ve kalıcı silme butonları
- [x] Tab'larda silinen öğe sayısı gösterimi

### v4.4 - Dashboard Yeniden Tasarım
- [x] Tarih aralığı filtresi (Bu Hafta, Bu Ay, 3 Ay, 6 Ay, Bu Yıl, Tümü, Özel)
- [x] Tüm istatistikler ve grafikler seçilen tarihe göre filtreleniyor
- [x] Dinamik bar chart gruplaması (günlük/haftalık/aylık otomatik)
- [x] Kategori dağılımı grafiği
- [x] Satış elemanı performans sıralaması
- [x] Kasa Durumu her zaman tüm zamanları gösteriyor

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
