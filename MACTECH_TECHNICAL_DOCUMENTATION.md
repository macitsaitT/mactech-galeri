# MACTech Ekosistemi — Teknik Mimari Dokümanı

**Modül**: M-Gallery (Oto Galeri CRM) — bu dokümanın kapsamı  
**Versiyon**: v5.30 (Iter 61)  
**Tarih**: 2026-02  
**Hazırlayan**: Geliştirme Ekibi  
**Hedef Okuyucu**: İş Sahibi · Dijital Pazarlama Ekibi · Reklam/Analitik Entegratörler

> ℹ️ Bu doküman M-Gallery modülünün **canlı codebase'inden** birebir çıkarıldı. M-Emlak ve diğer ekosistem modülleri farklı depo/altyapıdadır; bu dokümanda yer almıyor.

---

## 1. TEKNOLOJİ YIĞINI (STACK)

### 1.1 Frontend (`/app/frontend`)

| Katman | Teknoloji | Versiyon | Notu |
|---|---|---|---|
| Çerçeve | **React** | 19.x | CRA (`react-scripts` 5.0.1) ile build |
| Routing | **React Router DOM** | 7.5 | Tek-sayfa uygulama (SPA) |
| Stil | **Tailwind CSS** + `tailwind-merge` + `tailwindcss-animate` | — | Dark mode varsayılan |
| UI Kit | **Shadcn/UI** üzerine **Radix UI primitives** (`@radix-ui/*`) | 1.x–2.x | Dialog, Dropdown, Tabs, Toast vb. |
| İkonlar | **lucide-react** | 0.507 | — |
| Toast | **sonner** | 2.x | Mount: `<Toaster theme="dark" />` (App.js) |
| HTTP | **axios** | 1.8 | Interceptor ile JWT otomatik eklenir (`services/api.js`) |
| Form | **react-hook-form** | 7.56 | — |
| Grafik | **recharts** | 3.6 | Bar/Pie/Area chartlar (Dashboard, Reports) |
| Ekran→Görsel | **html2canvas** | 1.4 | Sosyal medya paylaşım kartı, sözleşme önizleme |
| İmza | **signature_pad** | 5.1 | Dijital sözleşmelerde canvas imza |
| Tarih | **react-day-picker** | 8.10 | — |
| Takvim | **embla-carousel-react** | 8.6 | Araç fotoğraf galerisi |
| QR | **qrcode.react** | 4.2 | QR-kod giriş akışı (`auth/qr/*`) |

**Build çıktısı**: `yarn build` → `/app/frontend/build` statik dosyalar.

### 1.2 Backend (`/app/backend`)

| Katman | Teknoloji | Versiyon | Notu |
|---|---|---|---|
| Çerçeve | **FastAPI** | 0.110 | ASGI, otomatik OpenAPI |
| Sunucu | **Uvicorn** (uvloop) | — | `0.0.0.0:8001`, supervisor altında |
| Async DB sürücüsü | **Motor** (MongoDB) | 3.3 | Sync `pymongo` 4.5 da var |
| Auth | **PyJWT** + **bcrypt** | 2.11 / 4.1 | HS256, 7 gün TTL |
| Validation | **Pydantic** | 2.12 | Tüm istek/yanıt modelleri |
| Zamanlanmış Görevler | **APScheduler** | 3.11 | Haftalık digest e-postası (saatlik tick) |
| E-posta | **Resend** | 2.29 | Haftalık digest + bildirimler |
| Ödeme | **Stripe** | 14.4 | (Senedy ya da aktif değilse dormant — abonelik için hazır) |
| HTTP istemci | **httpx** | 0.28 | MacTech SSO çağrıları |

**Servisler** (supervisor): `backend` (FastAPI) · `frontend` (React dev/build) · `code-server` · `code-server-nginx-proxy`

### 1.3 Veritabanı

| Katman | Teknoloji | Notu |
|---|---|---|
| Veritabanı | **MongoDB** | Tek instance, `MONGO_URL` env üzerinden |
| DB adı | `mactech_gallery` | `DB_NAME` env |
| ORM | Motor (asenkron native driver) | ODM kullanılmıyor — Pydantic modelleri + manuel projection |

> ⚠️ Firebase / Firestore **kullanılmıyor**. Tüm veri MongoDB üzerindedir.

### 1.4 Üçüncü Parti Entegrasyonlar

| Servis | Amaç | Endpoint/Konum |
|---|---|---|
| **MacTech SSO** | Tek-oturum açma (hybrid) | `https://www.mactech.tr/api/platform/sso/login` (httpx çağrısı) |
| **Resend** | Haftalık özet e-postası | `routes/digest.py` |
| **Stripe** | Abonelik/ödeme (hazır altyapı) | `routes/webhooks.py` |
| **Object Storage** | Araç fotoğrafı + dosya yükleme | `routes/uploads.py` (lokal DB-backed storage) |

> 🚫 Iyzico **şu an entegre değildir.** Stripe altyapısı mevcuttur; iyzico'ya geçilirse `routes/webhooks.py` ve frontend ödeme akışı genişletilmelidir.

### 1.5 Deploy Topolojisi

- **Preview env**: `REACT_APP_BACKEND_URL=https://image-gallery-live.preview.emergentagent.com`
- Backend `/api/*` route'ları → port 8001
- Diğer tüm route'lar → port 3000 (React)
- Kubernetes ingress otomatik yönlendirir

---

## 2. KULLANICI VE ÜYELİK AKIŞI (AUTH)

### 2.1 Mimari

> **Firebase Auth KULLANILMIYOR.** Hybrid yapı: yerel JWT + MacTech SSO katmanı.

**Akış sırası** (`POST /api/auth/login`):

```
[Login isteği] 
   ↓
1. MacTech SSO denemesi (httpx → mactech.tr)
   ↓ Başarılı?
   ├── EVET → MacTech kullanıcısı yerel DB'de yoksa oluştur → JWT döndür
   └── HAYIR → 2. Yerel DB bcrypt doğrulama → JWT döndür
   ↓ İkisi de fail
   → 401 "Geçersiz e-posta veya şifre"
```

### 2.2 Endpoint'ler (`routes/auth_routes.py`)

| Method | Path | Amaç |
|---|---|---|
| POST | `/api/auth/register` | Yerel kayıt (e-posta + şifre + isim + company_name) |
| POST | `/api/auth/verify-email` | E-posta doğrulama (kod) |
| POST | `/api/auth/resend-verification` | Doğrulama kodu yeniden gönder |
| POST | `/api/auth/login` | **Hybrid login** (yukarıdaki akış) |
| GET  | `/api/auth/me` | Mevcut kullanıcı (JWT'den) |
| POST | `/api/auth/google` | Google OAuth (Emergent-Google köprüsü — ŞU AN PASİF) |
| POST | `/api/auth/sso-login` | Doğrudan MacTech SSO token kabulü |
| POST | `/api/auth/qr/generate` | QR-kod oturumu başlat (mobil → desktop login) |
| GET  | `/api/auth/qr/status/{session_id}` | QR oturum durumu |
| POST | `/api/auth/qr/scan` / `approve` / `reject` | QR akış adımları |
| PUT  | `/api/auth/profile` | Profil güncelleme |
| DELETE | `/api/auth/delete-account` | Hesap sil |

### 2.3 JWT İçeriği

```json
{
  "user_id": "uuid",
  "email": "...",
  "org_id": "uuid (admin için user_id ile aynı, alt-kullanıcı için sahibinin)",
  "role": "admin|muhasebe|satis|...",
  "exp": "epoch + 7d"
}
```

- Algoritma: **HS256**
- Saklanma: Frontend `localStorage` (axios interceptor `Authorization: Bearer ...` header'a ekler)

### 2.4 Rol Tabanlı Yetkilendirme

| Rol | Açıklama |
|---|---|
| **admin** | Tüm yetkiler. `org_id == user_id`. Şirket sahibi. |
| **muhasebe** | Finans, sermaye, raporlar görür. Araç ekleme/silme yok. |
| **satis** | Satış personeli. Sermaye/finans **gizli** (`SalesPersonalView.jsx`). Sadece araç görüntüleme + satış. Backend `_require_finance_role` ile 403. |
| **destek** / özel roller | `PermissionsPage` üzerinden granüler `user_overrides` |

**Yetki kontrolü**:
- Frontend: `useApp().hasPermission(key)` (AppContext, 25s polling ile güncel)
- Backend: `routes/users.py::DEFAULT_PERMISSIONS` + endpoint başına `Depends(get_current_user)` + custom guard'lar

### 2.5 Multi-Tenant (Org) Yapı

- Her admin bir **organizasyon**'dur. `org_id = user_id`.
- Tüm veri (`cars`, `customers`, `transactions`, `contracts`, `capital`, ...) `org_id` field'ı ile partitionlu.
- Alt-kullanıcılar (satış personeli vb.) admin'in `org_id`'sini paylaşır.
- **Cross-org isolation backend tarafında zorlanır** — `org_id` her query'ye eklenir.

### 2.6 Şubeler (Branches)

- `routes/branches.py` ile yönetilir
- Her şube `org_id` + `branch_id` ile partitionlu
- Kullanıcılar bir şubeye atanabilir; raporlar şube bazlı filtrelenir

---

## 3. VERİTABANI ŞEMASI (MongoDB)

> Tüm collection'lar **org_id** + **deleted** flag ile çalışır. **Soft-delete** standarttır.

### 3.1 Collection Listesi (19 koleksiyon)

| Collection | Amaç | Ana indexler |
|---|---|---|
| `users` | Kullanıcılar | `email (unique)`, `org_id` |
| `cars` | Araç stok | `org_id`, `plate`, `status` |
| `customers` | Müşteriler | `org_id`, `phone` |
| `transactions` | Gelir/gider hareketleri | `org_id+date`, `car_id` |
| `capital` | Kasa nakit bakiye | `org_id (unique)` |
| `capital_movements` | Kasa hareket log'u | `org_id+timestamp` |
| `contracts` | Dijital sözleşmeler | `org_id+car_id+created_at`, `org_id+customer_id+created_at`, `id unique` |
| `branches` | Şubeler | `org_id` |
| `appointments` | Randevular | `org_id+date` |
| `installments` | Vadeli ödemeler | `org_id+car_id`, `due_date` |
| `invoices` | Faturalar | `org_id+date` |
| `notifications` | Bildirimler (in-app + e-posta) | `org_id+user_id` |
| `reminders` | Hatırlatıcılar | `org_id+remind_at` |
| `wanted_cars` | Aranan araç ilanları | `org_id` |
| `activity_logs` | Denetim log'u | `org_id+timestamp` |
| `year_end_transfers` | Yıl sonu devirleri | `org_id+year` |
| `permissions` | Yetki versiyonu (live sync) | `org_id (unique)` |
| `org_settings` | Org bazlı ayarlar (founding_capital vb.) | `org_id (unique)` |
| `uploaded_files` / `files` | Yüklenen dosya metadata | `org_id`, `id` |
| `subuser_sync_logs` | MacTech SSO senkron log'u | `org_id+timestamp` |

### 3.2 Anahtar Şema Örnekleri

#### `users`
```js
{
  id: "uuid",
  email: "user@example.com",
  password_hash: "bcrypt$...",
  name: "Ali Yılmaz",
  company_name: "Demo Galeri",
  phone: "+90...",
  role: "admin | muhasebe | satis",
  org_id: "uuid (admin için kendi id'si)",
  auth_provider: "local | mactech_sso | google",
  mactech_id: "mt_xxx (varsa)",
  user_overrides: { feature_key: bool },   // granüler yetki
  permissions_version: "uuid (her yetki değişikliğinde bump)",
  email_verified: bool,
  branch_id: "uuid | null",
  created_at: "ISO8601"
}
```

#### `cars`
```js
{
  id, org_id,
  plate, brand, model, year, color, km,
  fuel_type, gear, motor_no, sasi_no,
  purchase_price, sale_price,
  status: "Stokta | Satıldı | Kaporalı | Konsinye",
  ownership: "stock | consignment",
  photos: [{ url, ... }],
  expertise: { panel: condition, ... },     // 25 panel detay
  pending_expenses: [...],                  // inline tx (henüz capital'a yansımamış)
  customer_id, customer_name,               // satıldıysa
  sold_by_user_id, sold_by_name,            // satışı yapan personel snapshot
  sold_date, employee_share,
  muayene_tarihi, kasko_tarihi,
  deleted: false,
  created_at, updated_at
}
```

#### `customers`
```js
{
  id, org_id,
  name, phone, email,
  type: "Potansiyel | Satış Yapıldı | Satıcı",
  notes,                                    // Kimlik OCR ile TC otomatik buraya eklenirdi (kaldırıldı)
  deleted: false,
  created_at
}
```

#### `transactions`
```js
{
  id, org_id,
  type: "income | expense",
  category, amount, description,
  date: "YYYY-MM-DD",
  car_id: "uuid | null",                    // araç ilişkisi
  customer_id: "uuid | null",
  branch_id: "uuid | null",
  created_by, created_at,
  deleted: false
}
```

#### `contracts` (Iter 59+)
```js
{
  id, org_id,
  type: "kapora | delivery | sale",
  contract_no: "FILTER-001",
  car_id, customer_id,
  customer_name, car_plate, car_label, car_year,    // snapshot (referans bozulsa da kalır)
  sale_price, deposit_amount,
  payment_method, notes,
  due_date, delivery_date,
  seller_signature: "data:image/png;base64,...",    // base64, list endpoint'inde DAHİL EDİLMEZ
  buyer_signature: "data:image/png;base64,...",
  has_seller_signature: bool,                       // list endpoint'inde dahil (performans)
  has_buyer_signature: bool,
  created_at, created_by, created_by_name,
  deleted: false
}
```

#### `capital` + `capital_movements`
```js
// capital — tek satır per org, anlık bakiye
{ org_id, amount, updated_at }

// capital_movements — append-only log
{ id, org_id, type: "income|expense|adjust|deposit", amount, balance_after,
  category, description, ref_type: "tx|sale|deposit|...", ref_id, timestamp }
```

### 3.3 İlişkiler (Foreign-key niteliği)

> MongoDB'de FK constraint yok — uygulama katmanı zorlar.

```
users.id ─┬─< cars.created_by, cars.sold_by_user_id
          ├─< customers.created_by
          ├─< transactions.created_by
          └─< contracts.created_by

cars.id ─┬─< transactions.car_id
         ├─< installments.car_id
         ├─< contracts.car_id
         └─< invoices.car_id

customers.id ─┬─< cars.customer_id
              ├─< transactions.customer_id
              ├─< contracts.customer_id
              └─< appointments.customer_id

branches.id ─< users.branch_id, cars.branch_id, transactions.branch_id

org_id (admin user_id) ─< [HER COLLECTION] (multi-tenant partition)
```

---

## 4. MEVCUT ÖZELLİKLER (FEATURES)

### 4.1 Sayfalar (`/app/frontend/src/pages`)

| Sayfa | Route | Açıklama |
|---|---|---|
| **LoginPage** | `/login` | Hybrid auth (MacTech + yerel) |
| **Dashboard** | `/` | 4-tile sermaye özeti (Sermaye / Net Kâr / Araç Masraf / Toplam) + gelir-gider grafikler + nakit akışı görseli + yıl filtresi |
| **InventoryPage** | `/araclar` | Araç envanteri (kart + liste görünüm, filtre, toplu paylaş) |
| **CustomersPage** | `/musteri` | Müşteri CRM |
| **CalendarPage** | `/takvim` | Randevu takvimi |
| **FinancePage** | `/finans` | Gelir/gider tx'leri + sermaye hareketleri |
| **ReceivablesPage** | `/alacaklar` | Vadeli ödemeler |
| **CalculationsPage** | `/hesaplama` | Kâr-zarar hesap aracı |
| **StockAgingPage** | `/yaslandirma` | Stok yaşlanma raporu |
| **InspectionPage** | `/ekspertiz` | Ekspertiz/muayene takip |
| **EmployeePerformancePage** | `/personel-performans` | Satış personeli leaderboard |
| **WantedCarsPage** | `/aranan-araclar` | Aranan araç ilanı |
| **YearEndTransferPage** | `/yil-sonu` | Yıl sonu kapanış |
| **SettingsPage** | `/ayarlar` | Şirket ayarları, e-posta, logo |
| **UsersPage** | `/kullanicilar` | Alt-kullanıcı yönetimi |
| **PermissionsPage** | `/yetkiler` | Granüler rol/override yönetimi (25s live sync) |
| **ActivityLogsPage** | `/loglar` | Denetim log'u |
| **TrashPage** | `/cop` | Soft-delete edilen kayıtlar |
| **SalesPersonalView** | `/satis-paneli` | Satış rolü için kısıtlı dashboard (sermaye gizli) |

### 4.2 İşlevsel Modüller

**🚗 Araç Yönetimi (`AddCarModal`, `VehicleDetailModal`)**
- 25 panel ekspertiz diyagramı (`CarExpertiseDiagram`)
- Fotoğraf galeri (drag-drop upload)
- Belge kategorileri (ruhsat, kasko, plaka vb.)
- Inline masraf ekleme (henüz capital'a yansımamış pending masraflar)
- Satıcı seçimi (Satıcı tipi müşteri otomatik oluşur)

**💰 Sermaye & Finans**
- 4-tile dashboard: Kuruluş Sermayesi / Net Kâr / Araç Masraf / Toplam Sermaye
- "Kasa İşlemi" modalı (yatırım/çekim)
- Gider Analizi (Stok Yatırımı vs İşletme Gideri ayrımı)
- Dönem Nakit Akışı waterfall görsel

**👥 Müşteri CRM**
- 3 müşteri tipi: Potansiyel, Satış Yapıldı, Satıcı
- `CustomerDetailModal`: müşteri detayı + ödeme geçmişi + **sözleşme geçmişi** (cross-vehicle)

**📅 Randevu Takvim**
- Müşteri-araç eşleştirmesi
- Takvim görünüm (`react-day-picker`)
- Bildirim entegrasyonu

**📄 Dijital Sözleşmeler** (Iter 58-60)
- 3 tip: Kapora / Teslim Tutanağı / Satış
- Canvas imza (satıcı + alıcı, `signature_pad`)
- A4 yazdırılabilir HTML (PDF için browser print)
- MongoDB'ye kaydedilir → "Sözleşme Geçmişi" modalında yeniden yazdırılabilir
- Listeleme endpoint imza base64'lerini hariç tutar (perf)

**📊 Raporlama (`ReportModal`)**
- 8 rapor tipi: Genel, İşletme, Kâr/Zarar, Sermaye, Yıl Sonu, Kapora, Araç, Araç Masrafları
- Tarih filtresi + plaka arama
- Yazdırma + HTML indirme

**📤 Paylaşım**
- **Tek araç**: `ShareCardModal` → 3 format (Klasik / Instagram Story 9:16 / Kare 1:1), html2canvas ile PNG
- **Toplu**: `MultiShareModal` → katalog görseli + WhatsApp Web Share API
- **WhatsApp paylaş kartı** her araç kartında

**🔔 Bildirim & E-posta**
- Haftalık digest (APScheduler saatlik tick + org bazlı gün/saat kontrolü)
- In-app notifications (`/api/notifications/*`)
- ICS takvim entegrasyonu (kullanıcının kendi takvimine ekleme)

**🔒 Yetki Yönetimi**
- 25-saniye polling ile `permissions_version` kontrolü (live sync — admin yetki değiştirdiğinde alt-kullanıcı 25s içinde görür)
- Granüler `user_overrides` (her özellik için bool)

**🗑 Yedek/Geri Yükleme**
- Soft-delete + `TrashPage` üzerinden geri yükleme
- `routes/data_recovery.py` + `routes/exports.py` (JSON export/import)

---

## 5. ENTEGRASYON NOKTALARI — REKLAM TAKİBİ İÇİN

> Her etkileşim öğesinin **stabil bir `data-testid`'i** vardır. Bu, Meta Pixel / GTM / GA4 event tracking için ideal selektör'dür.

### 5.1 Auth Funnel (Conversion Tracking)

| Aksiyon | Selektör | Sayfa | Tetiklenen Backend Endpoint | Önerilen Pixel Event |
|---|---|---|---|---|
| Kayıt formu submit | `[data-testid="register-submit-btn"]` veya `button[type=submit]` form içinde `LoginPage.jsx` (signup mode) | `/login` | `POST /api/auth/register` | `CompleteRegistration` |
| Login submit | `button[type="submit"]` (LoginPage) | `/login` | `POST /api/auth/login` | `Lead` (custom) |
| E-posta doğrulama | `[data-testid="verify-email-btn"]` | `/login` | `POST /api/auth/verify-email` | `CompleteRegistration` (verified) |
| Hesap silme | `[data-testid="confirm-delete-account-btn"]` | `/ayarlar` | `DELETE /api/auth/delete-account` | `Custom: AccountDeleted` |
| Geri Login'e dön | `[data-testid="back-to-login-btn"]` | `/login` | — | — |

> 🎯 **Tavsiye**: GTM'de `dataLayer.push({event: 'register_success', user_id: X, ...})` çağrısı `AppContext.login()` fonksiyonundan sonra eklenebilir.

### 5.2 Operasyonel Aksiyonlar (Engagement & Funnel)

| Aksiyon | Selektör | Endpoint | Önerilen Event |
|---|---|---|---|
| Araç ekle (kaydet) | `[data-testid="add-car-submit-btn"]` veya `form` submit `AddCarModal` | `POST /api/cars` | `AddToCatalog` |
| Müşteri ekle | `[data-testid="add-customer-btn"]` → modal submit | `POST /api/customers` | `Lead` |
| Satış onaylama | `[data-testid="confirm-sale-btn"]` | `PATCH /api/cars/{id}/status` | **`Purchase`** (gelir vurgusu) |
| Kapora alma | `[data-testid="confirm-deposit-btn"]` | `PATCH /api/cars/{id}/status` (Kaporalı) | `InitiateCheckout` |
| Sözleşme yazdır | `[data-testid="contract-print-btn"]` | `POST /api/contracts` (arka plan) | `Custom: ContractSigned` |
| Sözleşme HTML indir | `[data-testid="contract-download-btn"]` | `POST /api/contracts` | `Custom: ContractDownloaded` |
| WhatsApp Paylaş | `[data-testid="share-{carId}"]` (dropdown) → `share-card-download-btn` | — | `Custom: VehicleShared` |
| Toplu paylaş | `[data-testid="bulk-share-trigger-btn"]` | — | `Custom: BulkShare` |
| Kasa işlemi (ödeme/yatırım) | `[data-testid="capital-submit-btn"]` | `POST /api/capital/...` | `Custom: CapitalMovement` |
| Randevu oluştur | `[data-testid="add-appointment-btn"]` | `POST /api/appointments` | `Schedule` |

### 5.3 Veri Tabanı Yansıması

Her etkileşim **synchronous** olarak MongoDB'ye yazar (axios → FastAPI → motor):

```
[Frontend Button Click]
        ↓ axios POST/PATCH
[FastAPI Router: Depends(get_current_user) yetki kontrolü]
        ↓ Pydantic validation
[Mongo insert/update + activity_logs append]
        ↓ response (Pydantic model, _id strip)
[Frontend: AppContext state refresh + toast]
```

**Activity log'u her kritik aksiyonda `activity_logs` collection'ına yazılır** — pazarlama ekibi geçmiş tracking için backend'den çekebilir.

### 5.4 GA4 / Meta Pixel Önerilen Mimari

```javascript
// /app/frontend/src/utils/analytics.js  (örnek — şu an mevcut değil)
export const trackEvent = (name, params = {}) => {
  // GA4
  window.gtag?.('event', name, params);
  // Meta Pixel
  window.fbq?.('trackCustom', name, params);
};

// AppContext.login() içinde:
trackEvent('login_success', { method: user.auth_provider, user_id: user.id });

// SaleModal handleConfirm() içinde:
trackEvent('vehicle_sold', { value: sale_price, currency: 'TRY', car_id });
```

> 💡 GTM container ID alındığında `public/index.html` head'ine + her kritik component'e `trackEvent()` çağrısı tek bir PR ile eklenebilir.

### 5.5 Önemli Conversion API (CAPI) Notu

Meta Pixel'in client-side fbq()'sine ek olarak, **server-side CAPI** entegrasyonu için backend `routes/webhooks.py` genişletilebilir — satış/kapora gibi yüksek-değer event'ler kayıp/ad-blocker durumlarına karşı serverdan da yollanır.

---

## ÖZET TABLO — TEK BAKIŞTA

| Konu | Durum |
|---|---|
| Stack | **React 19 + FastAPI + MongoDB** (Firebase YOK) |
| Auth | **Hybrid: MacTech SSO + Yerel JWT** (HS256, 7d) |
| Multi-Tenant | `org_id` ile her collection partition'lı |
| Roller | admin / muhasebe / satis + granüler override (25s live sync) |
| Ödeme | Stripe entegre, Iyzico değil |
| Email | Resend (haftalık digest) |
| Sayfalar | **20 sayfa** (Dashboard, Inventory, Customers, Calendar, ...) |
| API endpoints | ~120+ (22 router dosyası) |
| Collections | **19 MongoDB collection** (hepsi soft-delete) |
| Tracking-ready selektörler | **400+ data-testid** (stabil pixel/GA hook) |

---

**İletişim noktası**: Tüm modüllerin canlı kodu `/app` dizinindedir.  
**API dokümantasyonu**: `{BACKEND_URL}/docs` (FastAPI auto-generated Swagger UI)  
**Üretim deploy'u**: Vanilla PyPI bağımlılıkları (Emergent bağımlılığı kaldırıldı — Iter 61).
