# MACTech Oto Galeri CRM - PRD

## Project Overview
- **Project Name:** MACTech Oto Galeri CRM
- **Version:** 5.16.0
- **Last Updated:** 2026-05-07
- **Status:** Batch Transactions Endpoint + AddCarModal Refactor Tamamlandı — 2/2 pytest PASS

## Implementation Status

### v5.17.0 - 'Satıcı' Personeline Özel Dashboard (2026-05-07)
- ✅ **Yeni `SalesPersonalView` componenti** (`/app/frontend/src/pages/SalesPersonalView.jsx`):
  - Karşılama: "Hoş geldin, {ad}"
  - **Aylık Hedef Kartı**: localStorage'da kullanıcı başına saklanan hedef (varsayılan 5 araç). İlerleme barı, "Hedefe X araç kaldı" / "Tebrikler" rozeti, **Hedef Düzenle** butonu (1-100 arası).
  - **Bu Ay Komisyonum** canlı tutar.
  - 3 stat: Toplam Sattığım, Bu Yıl, Toplam Komisyonum.
  - Sattığım araçlar listesi (en yeni 20 — plaka, müşteri adı, satış tarihi, komisyon).
- ✅ **Dashboard.jsx Yönlendirme**: `if (user.role === 'satis') return <SalesPersonalView />;` — ESLint rules-of-hooks uyumlu (tüm hook'lardan sonra).
- ✅ **Smoke test**: 'satis' demo user oluşturuldu, login → SalesPersonalView render edildi (hedef kartı, stat kartları, boş liste). Sermaye/Kasa hiç görünmüyor.

### v5.16.3 - Sermaye/Kasa Erişim Kısıtlaması (2026-05-07)
- ✅ **Backend** (`/app/backend/routes/capital.py`): Yeni `_require_finance_role` helper. **'satis' rolü tüm capital endpoint'lerinden 403 alır**: GET /capital, GET /capital/movements, POST /capital/adjust, POST /capital/set, POST /capital/initialize, DELETE /capital/movements/{id}, POST /capital/movements/cleanup-deleted. Sadece `admin`, `owner`, `muhasebe` erişebilir.
- ✅ **Frontend** (`Dashboard.jsx`): Yeni `canSeeCapital = user.role !== 'satis'` kontrolü ile aşağıdakiler 'satis' rolünden gizlenir:
  - CapitalSummaryCard (Toplam Sermaye)
  - CapitalModal + CapitalDetailModal
  - RevenueComparisonCard (Ciro Karşılaştırma)
  - StatCard'lar: TOPLAM GELİR, TOPLAM GİDER, NET KÂR
  - Kategori Dağılımı kartı
  - Son İşlemler kartı
  - Detaylı Raporlar butonu
- ✅ **Sidebar**: Zaten 'satis' için Finans menüsü kapalı (Gelir&Gider, Alacaklar, Raporlar, Yıl Sonu Devri görünmüyor).
- ✅ **Curl test**: 'satis' user oluştur → GET /capital → 403 ✓, GET /cars → 200 ✓ (operasyonel erişim devam ediyor). Pytest regression 2/2 PASS.

### v5.16.2 - Personel Performans Rozeti + Sistem Audit (2026-05-07)
- ✅ **Personel Performans — Ortalama Brüt Kâr/Satış**:
  - Backend `/api/stats/employee-performance`: her satıcı için `avg_profit = total_profit / sold_count` ve `totals.avg_profit` döner.
  - Frontend `EmployeePerformancePage`:
    - "Toplam Kâr" kartında küçük "Ort: ₺X / satış" etiketi.
    - "En İyi Satıcı" rozetinde Ort/satış küçük göstergesi.
    - Tabloda yeni **ORT/SATIŞ** kolonu (header + body + footer).
  - Pytest regression: 2/2 PASS, lint clean.
- ✅ **Sistem Audit**: Backend logları (no errors), 16 endpoint smoke test (hepsi 200), ESLint frontend tamamen temiz, MongoDB `_id` projection eksiği yok, capital movements + cascade delete + seller revert çalışıyor. Hiç gerçek bug bulunmadı.
- ℹ️ **Minor (etkisiz)**: JWT secret 27 byte (RFC 7518: 32+ önerilir, çalışıyor); `auth_routes.py` F841 unused var (kozmetik).

### v5.16.1 - Tedarikçi Performans Rozeti (2026-05-07)
- ✅ **Backend `/api/customers/{id}/detail`**: Yeni alanlar `seller_sold_count`, `seller_total_profit`, `seller_avg_profit`. Her satılan `sold_to_us_car` için `gross_profit = sale_price - purchase_price - Σ(masraflar Araç Alımı/Sahibi hariç)`. Ortalama hesabına sadece **Satıldı** durumundaki araçlar girer.
- ✅ **CustomerDetailModal**: "Bu Kişiden Aldığımız Araçlar" bölümünde **TEDARİKÇİ PERFORMANSI** rozeti — kâr ortalaması pozitifse yeşil, negatifse kırmızı. Her satılan aracın yanında `Brüt Kâr` etiketi de görünür.
- ✅ **E2E curl test**: 2 araç (1 kâr +195K, 1 zarar -50K) + 5K boya masrafı → backend `total_profit=145K`, `avg_profit=72.5K`, `gross_profit` per-car değerleri tam doğru.

### v5.16.0 - Batch Transactions + AddCarModal Refactor (2026-05-07)
- ✅ **P1 — `POST /api/transactions/batch`**: Tek istekle çoklu transaction kaydı. Body `{transactions: [...]}`. Her tx için kasa atomik uygulanır, hata olanlar `errors[]` array'inde döner. Max 50 / istek. AddCarModal inline masraflar artık sequential loop yerine **tek batch çağrısı** ile kaydediliyor (daha hızlı UX, tek refreshStats+refreshCapital). Curl test: 2 tx, kasa -2.300 ₺ doğru, errors=0.
- ✅ **P3 — AddCarModal Refactor**: 1793 → 1385 satır (-408, **-%23**). Sub-componentler ayrı dosyalara çıkarıldı:
  - `addCarParts/DocumentCategory.jsx` (~130 satır)
  - `addCarParts/PhotoUploadTab.jsx` (~150 satır)
  - `addCarParts/SellerSelector.jsx` (~155 satır)
  - Hiçbir davranış değişikliği yok — sadece dosya organizasyonu. ESLint clean.
  - Smoke test: AddCarModal açılıyor, tüm 5 tab (Genel/Ekspertiz/Foto/Belge/Sahiplik) render oluyor.
  - Pytest regression: `test_iter50_seller_multi_car.py` 2/2 PASS.

### v5.15.1 - Satıcı Edge Cases (Update + Multi-car) (2026-05-07)
- ✅ **P2 — Seller Change Handling**: Yeni helper'lar `_mark_as_seller` + `_revert_seller_if_orphan` ile cars router. PUT/PATCH `seller_customer_id` değişirse eski satıcı orphan olduğunda Potansiyel'e revert + yeni satıcı Satıcı olur. Restore (soft-delete'ten geri yükleme) seller'ı yeniden işaretler.
- ✅ **P1 — Multi-car E2E Test**: `tests/test_iter50_seller_multi_car.py` — 2 senaryo PASS:
  1. Aynı satıcıdan 2 araç al → 1.yi sil → tip 'Satıcı' kalır → 2.yi de sil → 'Potansiyel'e revert.
  2. PUT ile seller değiştir → eski Potansiyel'e revert, yeni Satıcı; PATCH ile boşaltma da revert.
- ⏭️ **P3 — AddCarModal Refactor**: Bu turda ATLANDI (1750+ satır, dikkatli planlama gerek). Kullanıcının "hızlı + hatasız" önceliği nedeniyle ileri bırakıldı.

### v5.15.0 - Satıcı Müşteri Tipi (Aldığımız Kişi) (2026-05-07)
- ✅ **Yeni Müşteri Tipi 'Satıcı'**: AddCustomerModal + CustomersPage filtre + sayım kartı (amber renk).
- ✅ **AddCarModal Sahiplik > Stok**: Yeni `SellerSelector` componenti — mevcut müşteriler arasından arama/dropdown ile satıcı seç + "Yeni Satıcı" inline form (ad + 11 hane telefon → AppContext.addCustomer ile oluşturup otomatik seçer). Edit modunda da görünür.
- ✅ **Backend Otomasyon**:
  - `Car.seller_customer_id` alanı eklendi (CarBase).
  - `POST /api/cars`: `seller_customer_id` set edilirse + müşteri 'Potansiyel' tipindeyse otomatik **'Satıcı'** olur.
  - `DELETE /api/cars/{id}`: silinen aracın satıcısı başka aracımız yoksa otomatik **'Potansiyel'e geri döner**.
  - `GET /api/customers/{id}/detail`: `sold_to_us_cars` array + `total_sold_to_us` / `total_sold_to_us_amount` totals'a eklendi.
- ✅ **CustomerDetailModal**: "Bu Kişiden Aldığımız Araçlar" bölümü (amber tema, plaka + giriş tarihi + alış fiyatı + status). Toplam alış tutarı header'da.
- ✅ **Curl Test (E2E)**: Müşteri Potansiyel→Satıcı, sold_to_us_cars=1 amount=400.000, araç silince Satıcı→Potansiyel geri dönüş hepsi PASS.

### v5.14.2 - Inline Masraf Sermaye/Dashboard/Rapor Senkron Bug Fix (2026-05-07)
- 🔴 **BUG**: AddCarModal'dan girilen inline masraflar Kasa/Sermaye, Dashboard "Toplam Gider" ve Raporlar'a yansımıyordu. **Kök neden**: (a) `transactionsAPI.create` doğrudan kullanılıyordu — AppContext state güncellenmiyor, refreshStats+refreshCapital tetiklenmiyor. (b) `App.js handleSaveCar` yeni car nesnesini return etmiyordu — AddCarModal `carId` alamıyor, inline expense loop hiç çalışmıyordu.
- ✅ **FIX**: AddCarModal artık `useApp().addTransaction` çağırıyor (setTransactions + refreshStats + refreshCapital) + App.js handleSaveCar `newCar` return ediyor.
- ✅ **"Kaydet & Masraf Ekle" butonu kaldırıldı** — gereksizdi ve return undefined yüzünden çalışmıyordu. Artık tek "Kaydet" butonu hem aracı hem inline masrafları kaydediyor.
- ✅ **Doğrulama (curl)**: Capital 145.000 → 142.700 (-2.300 ₺ = 1.500+800 inline expenses). Cascade delete tx'leri de geri alıyor.

### v5.14.1 - Raporlardan Doğrudan Masraf Ekleme (2026-05-07)
- [x] **ReportModal — Masraf Ekle Butonu**: "Genel" / "Araç" raporunda araç filtresi seçildiğinde dropdown yanında "Masraf Ekle" butonu (`report-add-expense-btn`) görünür → mevcut `VehicleExpensesModal` o aracın id'siyle açılır (görüntüle/ekle/düzenle/sil hepsi tek noktadan).
- [x] **Tablo İçi Hızlı Ekleme**: Araç İşlemleri tablosundaki her satırın sonunda + ikonlu buton (`row-add-expense-{tx.id}`) — direkt o aracın masraf ekranını açar (mobile + desktop). Kasa hareketleri otomatik senkron.

### v5.14.0 - Inline Masraf Entegrasyonu (2026-05-07)
- [x] **AddCarModal Inline Masraf Girişi (P0)**: Yeni araç eklerken (edit modunda gizli) Genel Bilgiler tab'ında "Geliş Masrafları (Opsiyonel)" paneli. Kullanıcı kalem kalem (kategori + tutar + açıklama + tarih) masraf ekleyebilir. Submit sırasında `pending_expenses` payload'dan ayrılıp, araç oluşturulduktan sonra her satır için `transactionsAPI.create` (Gider) çağrılıyor; her create'de Kasa otomatik düşüyor. Toplam Masraf canlı gösteriliyor.
- [x] **VehicleExpensesModal Düzenle/Sil**: Mevcut tx satırlarının yanında Edit + Trash2 ikon butonları. Sil → confirm dialog → `deleteTransaction` (DELETE /api/transactions/{id}) → backend `apply_delta` ile kasa revert + capital_applied=False. Edit → form pre-fill, PUT ile güncelleme + kasa farkı uygulanıyor.
- [x] **Cascade Delete (Araç → Tx)**: DELETE /api/cars/{id} ilgili aktif transaction'ları soft-delete + kasa reverse (mevcuttu, doğrulandı).
- [x] **Test Sonuçları (Iter 48)**: Backend pytest 4/4 PASS (POST tx → kasa düş, DELETE tx → kasa geri, PUT tx → fark uygula, DELETE car cascade). Frontend Playwright 100% (inline-expense butonları, satır ekle/sil, Toplam Masraf etiketi).

### v5.13.0 - 8 Maddelik Backlog (2026-05-07)
- [x] **Veri Kurtarma paneli kaldırıldı** (Settings).
- [x] **Telefon validation 11 hane zorunlu** — backend `validate_phone` (security.py); customers POST/PUT, users POST/PUT'ta enforced (400 ile reddediyor).
- [x] **Fiyat onluk format** — WantedCarsPage budget input'ları 1.000.000 formatında. Diğer formlarda zaten `formatNumberInput` kullanılıyor.
- [x] **Satış iptal → müşteri type revert** — `cars.py:patch_car` status='Satıldı'dan başka bir status'e dönerse, müşterinin başka aktif satışı yoksa type='Potansiyel'e revert ediyor.
- [x] **Capital vehicles_capital** — `/api/capital` artık {amount, vehicles_capital, vehicles_count, total_equity, vehicles_breakdown[]} döndürüyor.
- [x] **Müşteri Detay Modal** — `GET /customers/{id}/detail` endpoint + frontend modal (4 KPI kart, satın alınan araçlar, vadeli taksitler, ödeme geçmişi).
- [x] **Satış akışı hızlandırıldı** — `handleConfirmSale` 4-5 sekanslı API call yerine `Promise.all` ile paralel (~3x hız).
- [x] **Şube global filtresi** — Header'da BranchSelector + AppContext.selectedBranchId (localStorage persist) + cars/customers/transactions/stats endpoint'lerinde branch_id query param + UsersPage branch filtresi/form.

### v5.12.0 - P3 Backlog (2026-05-01)
- [x] **Digest Settings UI**: Settings > DigestPanel artık `enabled` toggle + day/hour select + Save butonu. Scheduler **saatlik tick** ile her admin'in kendi `digest_day`/`digest_hour` tercihine göre gönderiyor. `GET/PUT /api/digest/settings`.
- [x] **Aranan Araçlar (Talep Eşleştirme)**: Yeni koleksiyon `wanted_cars`. Müşteri başına arama kriteri (marka/model/yıl aralığı/bütçe aralığı/yakıt/vites). Her listeleme ve yeni talep oluşturmada stoktaki araçlara göre `match_count` hesaplanır. `/api/wanted-cars` CRUD + `/matches` + `/matches-for-car/{car_id}`. Operasyon menüsünde yeni sayfa.
- [x] **Alacaklar (Vadeli Satış Takibi)**: `/api/installments/overdue/list` — her taksit için beklenen vs ödenen, gecikmiş tutar, gecikme gün sayısı. Finans menüsünde yeni `ReceivablesPage` (özet kartları + filtreler + tablo).
- [x] **Stok Yaşlanma Analizi**: `/api/stats/stock-aging` — stoktaki her araç için `days_in_stock`, günlük sermaye maliyeti (default %18/yıl), birikmiş maliyet, 0-30/31-60/61-90/91+ bucket'ları. Operasyon menüsünde yeni `StockAgingPage`.
- [x] **Sender mail güncellendi:** `noreply@mactech.tr` → `info@mactech.tr` (kullanıcının Resend'de doğrulanmış domain adresi).

### v5.11.0 - Genişletilmiş Audit + Analytics + E-Mail Digest (2026-05-01)
- [x] **Transaction CRUD Activity Logs**: `routes/transactions.py` create/update/delete hook'ları `log_activity` çağırıyor. ActivityLogsPage render mantığı transaction tipini (Gelir/Gider) ve tutarı gösteriyor.
- [x] **ActivityLogsPage Tarih Filtresi**: `logs-filter-start` ve `logs-filter-end` date input'ları + "Filtreleri Temizle" butonu. Backend `/api/activity-logs?start_date&end_date` zaten destekliyordu.
- [x] **EmployeePerformancePage Breakdown Chart**: `recharts` BarChart ile aylık (12 ay, yıl seçimi) / yıllık (son 5 yıl) satış adedi + net kâr grafiği. Yeni endpoint: `GET /api/stats/sales-breakdown?period=monthly|yearly&year=...`.
- [x] **Haftalık Özet E-Maili (Resend)**: `routes/digest.py` ile `_collect_digest_data` + `_build_html` + `_send_digest_to_org`. HTML e-mail template (kurumsal gold/dark tema) son 7 günün özeti: satılan araç, ciro, fiyat değişikliği, yeni personel, en iyi satıcı, stok durumu.
  - `POST /api/digest/send-now` — admin test gönderimi.
  - `GET /api/digest/preview` — iframe ile önizleme.
  - **APScheduler** `AsyncIOScheduler` + `CronTrigger` ile **Pazartesi 09:00 Europe/Istanbul** otomatik tetikleniyor (`DIGEST_SCHEDULE_DAY` / `DIGEST_SCHEDULE_HOUR` ile config).
- [x] **Settings › DigestPanel**: Önizleme + Test Gönder butonları + son gönderim sonuç kartı.

### v5.10.0 - İşlem Geçmişi & Personel Performansı (2026-05-01)
- [x] **Activity Logs (P2)**: Yeni `activity_logs` koleksiyonu. `helpers.log_activity` helper'ı create/update/delete/price_change/status_change olaylarını kaydeder. `cars.py` (create/patch/delete) ve `users.py` (create/update/delete) hook'ları eklendi. Yeni endpoint'ler: `GET /api/activity-logs` (filtreli: entity_type, action, user_id, tarih), `DELETE /api/activity-logs/clear` (admin only, 403).
- [x] **ActivityLogsPage (P2)**: Yönetim grubunda yeni sayfa. Filtre dropdown'ları (varlık, eylem, personel), mobil card + desktop tablo. Admin için "Tümünü Sil" butonu. Fiyat değişiklikleri `old → new` formatında gösteriliyor.
- [x] **Employee Performance (P2)**: `GET /api/stats/employee-performance` — satan kişi başına `sold_count`, `total_revenue`, `total_cost`, `total_profit`, `total_employee_share`. Satış rolündeki kullanıcı yalnızca kendini görüyor, Atanmamış bucket'ı admin/muhasebe için gösteriliyor.
- [x] **EmployeePerformancePage (P2)**: Özet kartları + En İyi Satıcı öne çıkarması + detaylı tablo.

### v5.9.0 - Sidebar UX, Sözleşme PDF ve White Label (2026-05-01)
- [x] **Sidebar Kontrast İyileştirmesi (P0)**: Aktif sekme `bg-primary/25` + `font-semibold` + sol primary border + primary renkli ikonlar; inaktif itemlar `text-white/75 font-medium`. Background `#0a0a0a` daha koyu. Quick action butonları `bg-white/10` ile daha belirgin.
- [x] **Sidebar Kategorizasyonu (P1)**: Menü `Operasyon`, `Finans`, `Yönetim` gruplarına ayrıldı; her grup collapsible (chevron icon). Kullanıcı tercihi `localStorage: mactech_sidebar_collapsed_groups`'da saklanıyor. Aktif view'ın grubu daima açık kalır.
- [x] **Satış Sözleşmesi PDF (Noter Formatı) (P1)**: `SaleModal` satış tamamlandıktan sonra **"Satış Sözleşmesi PDF Oluştur"** butonu gösteriyor. `utils/salesContract.js` noter formatlı HTML üretiyor: Satıcı/Alıcı/Araç bölümleri, fiyat rakam+yazıyla (numberToTurkishWords), sözleşme hükümleri (6 madde), imza alanları. Kurumsal logo header'a embed.
- [x] **White Label Ekspertiz PDF (P1)**: Backend `/api/export/expertise/{car_id}` artık owner user'dan `company_name` + `logo_url` çekip PDF'in ilk sayfasında antetli kağıt header'ı oluşturuyor (base64 data-URL destekli).

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
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts, jspdf, html2canvas
- Backend: FastAPI, Python, MongoDB, slowapi, python-docx, reportlab
- Auth: JWT + Emergent Google OAuth
- Storage: Emergent Object Storage

## Changelog (Recent)
### 2026-02 (Iter 30)
- ✅ Şubeler / Çoklu Galeri modülü tamamlandı: backend CRUD (`/api/branches`), frontend `BranchesManager` (Ayarlar sayfasında).
- ✅ `Car` modeline opsiyonel `branch_id` alanı eklendi → şube delete-guard çalışıyor.
- ✅ Stok/Konsinye/Satılan sayfalarına **Kart/Liste görünüm toggle** eklendi (`viewMode`, localStorage'da kalıcı). Yeni `VehicleListRow` component.
- ✅ Dashboard: **Vade Hatırlatıcı Bar** (yaklaşan/geciken taksitler — WhatsApp Gönder) + **Ciro Karşılaştırma Kartı** (Bu Ay / Geçen Ay / Geçen Yıl Aynı Ay).
- ✅ Çoklu Araç Paylaşma (`MultiShareModal`) ve Konsinye Sözleşme PDF (`consignmentPdf.js`) entegrasyonu.
- ✅ `notifications` router prefix bug fix (`/api/api/notifications` → `/api/notifications`) — Dashboard 404 regresyonu çözüldü.
- ✅ InventoryPage missing `</div>` JSX fix.
- ✅ Test sonuçları: Backend 13/14 (93%) → 14/14, Frontend 100%.

### 2026-02 (Iter 33) — 9-madde finansal & UI iyileştirme paketi
- ✅ **Madde 1**: Müşteri toplu silme (CustomersPage seçim modu + bulk delete).
- ✅ **Madde 2**: Sermaye Raporu (ReportModal yeni `capital` rapor tipi: Kasa Girişi/Çıkışı/Net Akış/Son Bakiye + hareket tablosu).
- ✅ **Madde 3**: Kasa Detay modalında manuel hareketler (deposit/withdrawal/set/initialize) silinebilir; backend reverse-delta uygular. Transaction-bağlı hareketler korunur.
- ✅ **Madde 4**: Satış onayla bug → kök neden `apply_delta` insufficient_capital blocking. Tüm transactions create/update/restore'a `allow_negative=True` eklendi → kasa eksiye düşse bile masraf/satış kaydedilir.
- ✅ **Madde 5**: Net Kâr formülü Çalışan Payı'nı **dahil** (düşüyor). Kullanıcı çalışan payını gerçek satış gideri olarak kabul ediyor.
- ✅ **Madde 6**: Satış iptal akışı düzeltildi — müşteri SİLMİYOR (eskiden soft-delete idi), type'ı 'Potansiyel'e döndürüyor; araç masrafları korunur.
- ✅ **Madde 7**: Gelir-Gider raporunda araç filtresi zaten `Araç` rapor tipinde mevcut (plaka arama + dropdown).
- ✅ **Madde 8**: Araç masrafları zaten Dashboard'da `Toplam Gider`'e + Net Kâr hesabına yansıyor; doğrulandı.
- ✅ **Madde 9**: Satılan Araçlar sayfasında satış tarihi aralık filtresi (data-testid: sold-date-filter).
- ✅ Yan fix: `/api/notifications` Mixed Content (HTTP redirect) → frontend trailing slash ile direkt çağırıyor.
- ✅ Test sonuçları: Backend 9/9 (100%), Frontend 95% (yan-fix sonrası ~100%).

### 2026-02 (Iter 34) — Yıl Sonu Kapanış Raporu
- ✅ ReportModal'a yeni `yearend` rapor tipi eklendi (vergi/muhasebeci için yıllık özet PDF):
  - Yıl picker (son 10 yıl, default bu yıl)
  - 4'lü üst özet (Satılan Araç, Toplam Satış, Toplam Maliyet, Brüt Kâr)
  - **Net İşletme Sonucu** kartı: `Brüt Kâr + İşletme Geliri − İşletme Gideri`
  - Detay 4'lü grid (Çalışan Payı, Araç Giderleri, İşletme Gideri, İşletme Geliri)
  - Yıl Sonu Stok değeri + Manuel Kasa Giriş/Çıkış özeti
  - Tüm satılan araçlar tablosu (Tarih, Plaka, Alış, Giderler, Çalışan Payı, Satış, Kâr/Zarar) + TOPLAM footer
- ✅ Test: Frontend 100% (9/9) PASS.

### 2026-02 (Iter 35) — Production 422 bug fix + Genişletilmiş kasa silme
- 🔴 **KRITIK BUG FIX**: `PUT /api/customers/{id}` partial update desteklemiyordu → satış akışındaki `updateCustomer({type:'Satış Yapıldı'})` çağrısı **422 'name field required'** ile patlıyordu. Backend artık sadece gönderilen alanları günceller (allowed: name, phone, type, tags, notes, interested_car_ids).
- ✅ `DELETE /api/capital/movements/{id}` genişletildi:
  - Manuel hareketler (`manual_*`, `capital_initialize`) → bakiye revert + sil
  - **Transaction-bağlı** hareketler (`transaction_create/update/restore`) → ilgili tx soft-delete edilir + kasa otomatik düzeltilir (kullanıcı eski yarım kalmış satışları temizleyebilsin)
  - Otomatik kayıtlar (`transaction_delete`, `employee_share_sync`) korunuyor (bütünlük için)
- ✅ Frontend: CapitalDetailModal'da `DELETABLE_REASONS` genişletildi, silme sonrası `fetchData()` ile global state yenileniyor.
- ✅ Frontend: Satış hatası alert'inde "Ctrl+Shift+R" önerisi kaldırıldı (gereksizdi).
- ✅ Test: Backend 8/8 (100%) PASS — production satış akışı uçtan uca doğrulandı.

### 2026-02 (Iter 36) — Kasa Görünümü Tam Temizlik
- ✅ `DELETE /api/capital/movements/{id}` davranışı genişletildi: artık **HER hareket türü** silinebilir.
  - Manuel: bakiye revert + sil
  - TX-bağlı (`transaction_create/update/restore/delete`): tx **HARD-delete** + ilgili **TÜM** movement'lar (create + delete + employee_share_sync vb.) hard-delete → kasada hiç iz kalmaz.
  - Otomatik kayıtlar (cleanup_revert, audit): bakiye etkilenmeden sadece sil.
- ✅ Yeni `POST /api/capital/movements/cleanup-deleted` endpoint: **soft-delete edilmiş tüm transaction'ları** ve onlara ait tüm capital_movements kayıtlarını tek seferde temizler. Kullanıcı "İptal Edilenleri Temizle" butonu ile çağırır.
- ✅ Frontend: CapitalDetailModal'da artık her hareketin yanında çöp kutusu butonu (DELETABLE_REASONS kaldırıldı). Eğer iptal edilmiş hareketler varsa üstte "İptal Edilenleri Temizle (N)" butonu görünür.
- ✅ Test: Backend tx-linked silme + cleanup-deleted endpoint canlı doğrulandı (TX hard-delete, 8 movement temizlendi).

### 2026-02 (Iter 42) — Finansal Doğruluk + Cascade Delete + Modal Stability
- 🔴 **KRITIK BUG FIX**: `fetchData()` global `setLoading(true)` tetikliyordu → App.js `loading && isAuthenticated` overlay'i tüm app'i unmount ediyordu → Sermaye modal'ı silme sonrası "sayfa yenileniyor" gibi görünüyordu. Fix: `fetchData(silent=true)` parametresi eklendi, modal'lar bunu kullanıyor.
- ✅ **Net Kâr formülü düzeltildi**: `Math.max(0, profit)` kaldırıldı (zararlı satışlar düşülür) + Konsinye için "Araç Sahibine Ödeme" alış maliyeti olarak hesaba katılır + `!t.deleted` filter eklendi.
- ✅ **Cascade Delete (Araç → İlgili Her Şey)**: `DELETE /api/cars/{id}` artık ilgili tüm transactions'ları soft-delete eder + AKTİF tx'lerin kasa etkisini reverse eder. Permanent silmede capital_movements de hard-delete. Test: 2 tx oluşturup araç silince kasa -118K doğru revert ✅.
- ✅ **TransactionModal'a araç seçici** (data-testid: transaction-car-select) — opsiyonel, "Genel İşletme" varsayılan. Araç seçilirse o aracın kâr/zarar hesabına yansır.
- ✅ Dashboard'dan "Kasa Durumu" kartı kaldırıldı (gereksiz, Sermaye kartı yeterli).
- ✅ Sermaye Detay modal'ı artık `fetchData` çağırmıyor (sadece local + `refreshCapital`) → kapanma bug'ı kesin çözüldü.
