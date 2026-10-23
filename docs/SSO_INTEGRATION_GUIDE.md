# SSO (Single Sign-On) Entegrasyon Rehberi

## 🎯 Genel Bakış

MACTech Oto Galeri CRM uygulaması, ana MACTech platformu (`mactech.tr`) ile SSO (Tek Oturum Açma) entegrasyonunu desteklemektedir. Kullanıcılar ana sitede giriş yaptıktan sonra, CRM uygulamasına otomatik olarak giriş yapabilirler.

## 🔐 SSO Akışı

```
1. Kullanıcı mactech.tr'de giriş yapar
2. Ana platform SSO token'ı oluşturur
3. Kullanıcı CRM'e yönlendirilir: galeri.mactech.tr/sso-callback?sso_token=xxx
4. CRM backend'i token'ı mactech.tr/api/platform/sso/verify adresinden doğrular
5. Başarılıysa, kullanıcı JWT token alır ve dashboard'a yönlendirilir
```

## 📁 Dosya Yapısı

### Frontend
- **`/app/frontend/src/pages/SSOCallbackPage.jsx`**
  - SSO callback endpoint'i
  - URL'den `sso_token` parametresini alır
  - Backend'e doğrulama isteği gönderir
  - Başarılı girişte token'ı localStorage'a kaydeder

- **`/app/frontend/src/App.js`**
  - React Router ile `/sso-callback` route'u tanımlanmış
  - SSOCallbackPage bileşeni burada yüklenir

- **`/app/frontend/src/services/api.js`**
  - `authAPI.ssoLogin(ssoToken)` fonksiyonu
  - Backend'e SSO token'ı gönderir

### Backend
- **`/app/backend/routes/auth_routes.py`**
  - `POST /api/auth/sso-login` endpoint'i (satır 353-451)
  - MACTech platformundan token doğrulama
  - Kullanıcı kaydı veya güncellemesi
  - JWT token oluşturma

## 🔧 Backend Endpoint Detayları

### POST /api/auth/sso-login

**Request:**
```json
{
  "sso_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**MACTech Platform Doğrulama İsteği:**
```http
POST https://mactech.tr/api/platform/sso/verify
Content-Type: application/json

{
  "sso_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Beklenen Platform Yanıtı:**
```json
{
  "valid": true,
  "user": {
    "mactech_id": "mtc_12345",
    "email": "kullanici@example.com",
    "full_name": "Ali Veli",
    "phone": "+90 555 123 4567"
  }
}
```

**CRM Yanıtı (Başarılı):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-kullanıcı-id",
    "email": "kullanici@example.com",
    "company_name": "Ali Veli",
    "mactech_id": "mtc_12345",
    "role": "admin",
    "org_id": "uuid-org-id"
  },
  "message": "SSO ile giriş başarılı"
}
```

## 👥 Kullanıcı Yönetimi

SSO ile giriş yapan kullanıcılar için:

1. **İlk Giriş:**
   - `mactech_id` ile kullanıcı aranır
   - Bulunamazsa `email` ile aranır
   - Hiç yoksa yeni kullanıcı oluşturulur
   - Otomatik olarak `admin` rolü atanır
   - `email_verified: true` olarak işaretlenir

2. **Sonraki Girişler:**
   - `mactech_id` ile kullanıcı bulunur
   - JWT token oluşturulur
   - `last_login` zamanı güncellenir

## 🗄️ MongoDB Kullanıcı Yapısı

```javascript
{
  "id": "uuid",
  "mactech_id": "mtc_12345",  // MACTech platform ID
  "email": "kullanici@example.com",
  "password_hash": null,  // SSO kullanıcıları için şifre yok
  "company_name": "Ali Veli",
  "phone": "+90 555 123 4567",
  "role": "admin",
  "org_id": "uuid",
  "auth_provider": "sso",
  "email_verified": true,
  "created_at": "2024-01-15T10:30:00Z",
  "last_login": "2024-01-20T14:45:00Z"
}
```

## 🧪 Test Etme

### Manuel Test (Yerel Ortam)

1. **Backend Test:**
```bash
curl -X POST http://localhost:8001/api/auth/sso-login \
  -H "Content-Type: application/json" \
  -d '{"sso_token": "test_token_123"}'
```

2. **Frontend Test:**
```
http://localhost:3000/sso-callback?sso_token=test_token_123
```

### Canlı Ortam (Railway)

Ana platformdan yönlendirme URL'si:
```
https://galeri.mactech.tr/sso-callback?sso_token={GENERATED_TOKEN}
```

## ⚠️ Önemli Notlar

1. **Platform API Gereksinimi:**
   - `mactech.tr/api/platform/sso/verify` endpoint'inin aktif olması gerekir
   - Endpoint, token doğrulama ve kullanıcı bilgilerini dönmelidir

2. **Güvenlik:**
   - SSO token'lar tek kullanımlık olmalıdır
   - Token'ların expire süresi olmalıdır (önerilen: 5 dakika)
   - HTTPS kullanımı zorunludur

3. **Hata Yönetimi:**
   - Token geçersizse kullanıcı ana siteye yönlendirilir
   - Bağlantı hatalarında kullanıcıya bilgi mesajı gösterilir
   - Normal login sayfasına dönüş seçeneği sunulur

## 🔗 İlgili Dosyalar

- Frontend: `/app/frontend/src/pages/SSOCallbackPage.jsx`
- Backend: `/app/backend/routes/auth_routes.py`
- API Service: `/app/frontend/src/services/api.js`
- Router: `/app/frontend/src/App.js`

## 📝 Sonraki Adımlar

1. ✅ Backend SSO endpoint'i tamamlandı
2. ✅ Frontend callback sayfası oluşturuldu
3. ✅ React Router entegrasyonu yapıldı
4. ⏳ MACTech platform API'sinin hazırlanması bekleniyor
5. ⏳ Canlı ortamda uçtan uca test yapılacak

## 🐛 Sorun Giderme

### "SSO servisi bağlantı hatası"
- MACTech platform API'si erişilebilir değil
- DNS ayarlarını kontrol edin
- Platform API'sinin aktif olduğundan emin olun

### "SSO token geçersiz"
- Token'ın süresi dolmuş olabilir
- Ana siteden tekrar giriş yapın
- Token formatını kontrol edin

### "SSO token bulunamadı"
- URL'de `sso_token` parametresi eksik
- Yönlendirme URL'sini kontrol edin

---

**Son Güncelleme:** 5 Nisan 2026
**Durum:** ✅ Kod tamamlandı, Platform API bekleniyor
