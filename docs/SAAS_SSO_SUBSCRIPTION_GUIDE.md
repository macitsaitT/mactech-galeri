# MACTech Uygulama Ekosistemi - SSO & Subscription Entegrasyon Rehberi

## 🎯 Sistem Mimarisi

```
mactech.tr (Ana Platform)
    │
    ├─ Kullanıcı Yönetimi
    ├─ Abonelik Yönetimi
    ├─ Ödeme İşlemleri
    │
    └─ Uygulamalar:
        ├─ 🚗 Galeri CRM (Trial: 14 gün | Pro: 299₺/ay)
        ├─ 🏠 Emlak CRM  (Trial: 14 gün | Pro: 399₺/ay)
        └─ ... (diğer uygulamalar)
```

---

## 📋 İş Akışı

### 1. Kullanıcı Kaydı ve Trial Başlatma

```
1. Kullanıcı mactech.tr'de kayıt olur
   ↓
2. Uygulamalar sayfasında Galeri CRM'i görür
   ↓
3. "14 Gün Ücretsiz Dene" butonuna tıklar
   ↓
4. WEBHOOK: trial.started → Galeri backend
   ↓
5. Kullanıcı SSO ile galeri.mactech.tr'ye giriş yapar
   ↓
6. 14 gün boyunca tam erişim ✅
```

### 2. Trial Dolduğunda

```
15. gün:
   ↓
Trial süresi doldu
   ↓
Kullanıcı SSO ile giriş yapmaya çalışır
   ↓
❌ Erişim reddedilir
   ↓
"Trial doldu, Pro'ya geç" mesajı gösterilir
   ↓
mactech.tr/pro'ya yönlendirilir
```

### 3. Pro Satın Alma

```
Kullanıcı Pro plana geçer
   ↓
WEBHOOK: subscription.created → Galeri backend
   ↓
subscription: "pro", payment_status: "active"
   ↓
Kullanıcı SSO ile giriş yapar
   ↓
✅ Sınırsız erişim
```

### 4. Aylık Ödeme Kontrolü

```
Her ay:
   ↓
Ödeme başarılı mı?
   │
   ├─ ✅ Evet → WEBHOOK: subscription.payment_success
   │            └─ Erişim devam eder
   │
   └─ ❌ Hayır → WEBHOOK: subscription.payment_failed
                 └─ access_blocked: true
                 └─ Giriş yapamaz ❌
                 └─ Veriler korunur 🔒
```

---

## 🔧 Entegrasyon Gereksinimleri

### 1️⃣ **MACTech Websitesinde Oluşturulacaklar**

#### A) SSO Token Verify API

**Endpoint:**
```
POST https://www.mactech.tr/api/platform/sso/verify
Content-Type: application/json
```

**Request:**
```json
{
  "sso_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Başarılı - Trial Aktif):**
```json
{
  "valid": true,
  "user": {
    "mactech_id": "mtc_12345",
    "email": "kullanici@example.com",
    "full_name": "Ali Veli",
    "phone": "+90 555 123 4567",
    "apps": {
      "galeri": {
        "subscription": "free",
        "payment_status": "trial",
        "trial_active": true,
        "trial_start": "2024-04-05T10:30:00Z",
        "trial_end": "2024-04-19T10:30:00Z",
        "trial_days_left": 10
      },
      "emlak": {
        "subscription": "free",
        "payment_status": "",
        "trial_active": false
      }
    }
  }
}
```

**Response (Başarılı - Pro Aktif):**
```json
{
  "valid": true,
  "user": {
    "mactech_id": "mtc_12345",
    "email": "kullanici@example.com",
    "full_name": "Ali Veli",
    "phone": "+90 555 123 4567",
    "apps": {
      "galeri": {
        "subscription": "pro",
        "payment_status": "active",
        "trial_active": false,
        "last_payment": "2024-05-01T00:00:00Z",
        "next_payment_due": "2024-06-01T00:00:00Z"
      }
    }
  }
}
```

**Response (Token Geçersiz):**
```json
{
  "valid": false,
  "error": "Invalid or expired token"
}
```

---

#### B) Webhook Events

**Webhook URL:**
```
POST https://galeri.mactech.tr/api/webhooks/app-access
Authorization: Bearer {WEBHOOK_SECRET}
Content-Type: application/json
```

**Webhook Secret:**
```
whsec_galeri_[RANDOM_STRING]
```
Bu secret backend başlatıldığında console'da loglanır. Production'da env variable olarak saklanmalı.

---

##### **Event 1: trial.started**

Kullanıcı 14 günlük deneme başlattığında gönderilir.

```json
{
  "event": "trial.started",
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "full_name": "Ali Veli",
  "phone": "+90 555 123 4567",
  "app": "galeri",
  "trial_days": 14,
  "trial_start": "2024-04-05T10:30:00Z",
  "trial_end": "2024-04-19T10:30:00Z"
}
```

**Galeri Backend Aksiyonu:**
- Kullanıcı oluşturulur (yoksa)
- `trial_active: true`
- `trial_end` kaydedilir
- `access_blocked: false`

---

##### **Event 2: subscription.created**

Kullanıcı Pro plan satın aldığında gönderilir.

```json
{
  "event": "subscription.created",
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "app": "galeri",
  "plan": "pro",
  "started_at": "2024-04-10T15:00:00Z"
}
```

**Galeri Backend Aksiyonu:**
- `subscription: "pro"`
- `payment_status: "active"`
- `trial_active: false`
- `access_blocked: false`

---

##### **Event 3: subscription.payment_success**

Aylık ödeme başarılı olduğunda gönderilir.

```json
{
  "event": "subscription.payment_success",
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "app": "galeri",
  "paid_amount": 299.00,
  "payment_date": "2024-05-01T00:00:00Z",
  "next_payment_due": "2024-06-01T00:00:00Z"
}
```

**Galeri Backend Aksiyonu:**
- `payment_status: "active"`
- `access_blocked: false`
- `last_payment` güncellenir
- `next_payment_due` kaydedilir

---

##### **Event 4: subscription.payment_failed**

Aylık ödeme başarısız olduğunda gönderilir.

```json
{
  "event": "subscription.payment_failed",
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "app": "galeri",
  "failed_at": "2024-06-01T00:00:00Z",
  "reason": "insufficient_funds"
}
```

**Galeri Backend Aksiyonu:**
- `payment_status: "past_due"`
- `access_blocked: true`
- `access_blocked_reason: "payment_failed"`
- **Kullanıcı verileri KORUNURve silinmez**
- Giriş yapmaya çalışırsa → "Ödeme yapın" mesajı

---

##### **Event 5: subscription.cancelled**

Kullanıcı Pro planını iptal ettiğinde gönderilir.

```json
{
  "event": "subscription.cancelled",
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "app": "galeri",
  "cancelled_at": "2024-05-15T10:00:00Z"
}
```

**Galeri Backend Aksiyonu:**
- `subscription: "free"`
- `payment_status: "cancelled"`
- `access_blocked: true`
- `access_blocked_reason: "subscription_cancelled"`
- **Kullanıcı verileri korunur**
- Giriş yapmaya çalışırsa → "Abonelik iptal edildi" mesajı

---

#### C) SSO Redirect URL

Kullanıcı "Galeri'ye Git" butonuna tıkladığında:

```
https://galeri.mactech.tr/sso-callback?sso_token={GENERATED_TOKEN}
```

**Token Formatı (JWT Örneği):**
```json
{
  "mactech_id": "mtc_12345",
  "email": "kullanici@example.com",
  "app": "galeri",
  "iat": 1617616800,
  "exp": 1617617100  // 5 dakika geçerli
}
```

---

### 2️⃣ **Galeri Backend (Hazır)**

#### Webhook Endpoint
```
POST /api/webhooks/app-access
Authorization: Bearer {WEBHOOK_SECRET}
```

Events: `trial.started`, `subscription.created`, `subscription.payment_success`, `subscription.payment_failed`, `subscription.cancelled`

#### SSO Login Endpoint
```
POST /api/auth/sso-login
Content-Type: application/json

{
  "sso_token": "xxx"
}
```

**Response (Erişim Var):**
```json
{
  "token": "jwt_token",
  "user": { ... },
  "access_info": {
    "has_access": true,
    "reason": "trial_active",
    "message": "Deneme süresi aktif (10 gün kaldı)",
    "subscription_type": "trial",
    "trial_days_left": 10
  }
}
```

**Response (Erişim Yok - Trial Doldu):**
```json
{
  "detail": {
    "error": "access_denied",
    "reason": "trial_expired",
    "message": "14 günlük deneme süreniz sona erdi. Pro plana geçerek devam edin!",
    "redirect_url": "https://www.mactech.tr/pro",
    "action": "show_trial_expired"
  }
}
```

---

## 🧪 Test Senaryoları

### Senaryo 1: Yeni Kullanıcı - Trial Başlatma

1. **mactech.tr'de:**
   - Kullanıcı kayıt olur: `test@example.com`
   - "14 Gün Ücretsiz Dene" butonuna tıklar
   - Webhook gönderilir: `trial.started`

2. **Galeri Backend:**
   ```bash
   curl -X POST https://galeri.mactech.tr/api/webhooks/app-access \
     -H "Authorization: Bearer whsec_galeri_xxx" \
     -H "Content-Type: application/json" \
     -d '{
       "event": "trial.started",
       "mactech_id": "mtc_test_001",
       "email": "test@example.com",
       "full_name": "Test Kullanıcı",
       "phone": "+90 555 123 4567",
       "app": "galeri",
       "trial_days": 14,
       "trial_start": "2024-04-05T10:00:00Z",
       "trial_end": "2024-04-19T10:00:00Z"
     }'
   ```

3. **SSO ile Giriş:**
   - mactech.tr'de "Galeri'ye Git" tıkla
   - SSO token oluştur, yönlendir:
     ```
     https://galeri.mactech.tr/sso-callback?sso_token=xxx
     ```
   - ✅ Başarılı giriş, 14 gün erişim

---

### Senaryo 2: Trial Doldu

1. **15. gün (trial_end geçti):**
   - Kullanıcı SSO ile giriş yapmaya çalışır
   - Backend yanıtı:
     ```json
     {
       "detail": {
         "error": "access_denied",
         "reason": "trial_expired",
         "message": "14 günlük deneme süreniz sona erdi...",
         "redirect_url": "https://www.mactech.tr/pro",
         "action": "show_trial_expired"
       }
     }
     ```
   - ❌ Giriş yapamaz
   - 3 saniye sonra `mactech.tr/pro`'ya yönlendirilir

---

### Senaryo 3: Pro Satın Alma

1. **mactech.tr'de:**
   - Kullanıcı Pro plana geçer
   - Webhook gönderilir: `subscription.created`

2. **Galeri Backend:**
   ```bash
   curl -X POST https://galeri.mactech.tr/api/webhooks/app-access \
     -H "Authorization: Bearer whsec_galeri_xxx" \
     -H "Content-Type: application/json" \
     -d '{
       "event": "subscription.created",
       "mactech_id": "mtc_test_001",
       "email": "test@example.com",
       "app": "galeri",
       "plan": "pro",
       "started_at": "2024-04-20T12:00:00Z"
     }'
   ```

3. **SSO ile Giriş:**
   - ✅ Sınırsız erişim

---

### Senaryo 4: Aylık Ödeme Başarısız

1. **1 ay sonra:**
   - Ödeme başarısız
   - Webhook: `subscription.payment_failed`

2. **Galeri Backend:**
   ```bash
   curl -X POST https://galeri.mactech.tr/api/webhooks/app-access \
     -H "Authorization: Bearer whsec_galeri_xxx" \
     -H "Content-Type: application/json" \
     -d '{
       "event": "subscription.payment_failed",
       "mactech_id": "mtc_test_001",
       "email": "test@example.com",
       "app": "galeri",
       "failed_at": "2024-05-20T00:00:00Z"
     }'
   ```

3. **SSO ile Giriş:**
   - ❌ Giriş yapamaz
   - "Ödeme yapın" mesajı
   - `mactech.tr/odeme`'ye yönlendirilir

---

## 📊 Durum Matrisi

| Subscription | Payment Status | Trial Active | Trial End | Erişim | Mesaj |
|--------------|----------------|--------------|-----------|--------|-------|
| free | - | false | - | ❌ | "Trial başlat" |
| free | trial | true | Gelecek | ✅ | "X gün kaldı" |
| free | trial | false | Geçmiş | ❌ | "Trial doldu" |
| pro | active | - | - | ✅ | "Pro aktif" |
| pro | past_due | - | - | ❌ | "Ödeme yapın" |
| pro | cancelled | - | - | ❌ | "Abonelik iptal" |

---

## 🔐 Güvenlik

1. **Webhook Secret:**
   - Production'da `.env` dosyasında saklanmalı
   - Her istek `Authorization: Bearer {secret}` ile doğrulanır

2. **SSO Token:**
   - JWT formatı önerilir
   - Expire süresi: 5 dakika
   - Tek kullanımlık olmalı (opsiyonel)

3. **HTTPS:**
   - Tüm webhook ve SSO istekleri HTTPS üzerinden yapılmalı

---

## 📝 Websitede Yapılacaklar (Checklist)

### Gerekli Endpoint'ler:
- [ ] `POST /api/platform/sso/verify` (SSO token doğrulama)
- [ ] SSO token oluşturma mekanizması

### Webhook Entegrasyonu:
- [ ] Galeri webhook URL'i kaydet: `https://galeri.mactech.tr/api/webhooks/app-access`
- [ ] Webhook secret al (backend console'dan)
- [ ] Event trigger'ları kur:
  - [ ] Trial başlatıldığında → `trial.started`
  - [ ] Pro satın alındığında → `subscription.created`
  - [ ] Aylık ödeme başarılı → `subscription.payment_success`
  - [ ] Aylık ödeme başarısız → `subscription.payment_failed`
  - [ ] Abonelik iptal → `subscription.cancelled`

### SSO Akışı:
- [ ] "Galeri'ye Git" butonu ekle
- [ ] Butona tıklanınca:
  1. SSO token oluştur (JWT)
  2. Yönlendir: `https://galeri.mactech.tr/sso-callback?sso_token={token}`

---

## 🆘 Sorun Giderme

### Webhook Çalışmıyor
- Secret doğru mu? (Console'dan kontrol et)
- Authorization header var mı?
- JSON formatı doğru mu?

### SSO Giriş Başarısız
- `https://www.mactech.tr/api/platform/sso/verify` erişilebilir mi?
- Token geçerli mi (expire kontrolü)?
- Response formatı doğru mu (apps.galeri alanı)?

### Trial/Pro Durumu Yanlış
- Webhook gönderildi mi?
- Event tipi doğru mu?
- MongoDB'de kullanıcı bilgileri güncel mi?

---

**Websiteleri:**
- Test/Dev: https://tech-dashboard-31.preview.emergentagent.com/
- Production: https://www.mactech.tr/
- Galeri CRM: https://galeri.mactech.tr/

**Webhook Secret Alma:**
```bash
curl https://galeri.mactech.tr/api/webhooks/secret
```

---

**Son Güncelleme:** 5 Nisan 2026  
**Durum:** ✅ Backend hazır, Websitede entegrasyon bekleniyor
