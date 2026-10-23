# Railway "Invalid Contents" Hatası - Debug Rehberi

## 🚨 Sorun
Galeri uygulamanıza giriş yapmaya çalışırken "Invalid contents" hatası alıyorsunuz.

## 🔍 Sebebi
1. **Ana Sebep:** Websitenizdeki e-posta ile galeri uygulamasına kayıt olmadınız
2. **Teknik Sebep:** Railway backend'den gelen "Invalid credentials" mesajı frontend'e ulaşmıyor

## ✅ HIZLI ÇÖZÜM (Şu An İçin)

### Adım 1: Galeri Uygulamasına Kayıt Olun

**Railway domain'inizde:**
```
https://galeri.mactech.tr
```

1. "Hesabınız yok mu? Kayıt olun" linkine tıklayın
2. **Websitenizdeki aynı e-posta adresini kullanın**
3. Şirket adı ve telefon bilgilerinizi girin
4. Kayıt olun
5. Şimdi bu e-posta ve şifre ile giriş yapabilirsiniz

---

## 🔧 Railway Deployment Kontrolü

### Kontrol 1: Environment Variables

Railway Dashboard'da **Backend Service** → **Variables** bölümünde şunlar olmalı:

```env
MONGO_URL=mongodb+srv://[username]:[password]@[cluster].mongodb.net/[dbname]?retryWrites=true&w=majority
DB_NAME=galeri_crm
CORS_ORIGINS=*
```

Railway Dashboard'da **Frontend Service** → **Variables** bölümünde:

```env
REACT_APP_BACKEND_URL=https://galeri.mactech.tr
```

⚠️ **ÖNEMLİ:** 
- Frontend URL'sinde sonunda `/` olmamalı
- `https://` ile başlamalı

### Kontrol 2: Backend Erişilebilirlik

Terminal veya browser'da test edin:

```bash
# Backend health check
curl https://galeri.mactech.tr/api/health

# Başarılı yanıt:
{"status":"healthy"}
```

### Kontrol 3: CORS Headers

```bash
curl -I https://galeri.mactech.tr/api/health

# Şu satır olmalı:
Access-Control-Allow-Origin: *
```

### Kontrol 4: Browser Console (F12)

1. `F12` tuşuna basın
2. **Network** sekmesine gidin
3. Giriş yapmayı deneyin
4. `login` isteğine tıklayın
5. **Response** bölümüne bakın

**Beklenen Response:**
```json
{
  "detail": "Invalid credentials"
}
```

**Eğer farklı bir şey görüyorsanız** (örn: HTML, 502, 504), backend çalışmıyor demektir.

---

## 🐛 "Invalid Contents" Hatası Nereden Geliyor?

Bu hata şu sebeplerden biri olabilir:

### 1. Backend Response JSON Değil
**Kontrol:**
```bash
curl -X POST https://galeri.mactech.tr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123"}'
```

**Beklenen:** JSON yanıt  
**Sorunlu:** HTML veya boş yanıt

### 2. CORS Hatası
**Belirti:** Browser console'da:
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Çözüm:** Backend service'de `CORS_ORIGINS=*` olduğundan emin olun

### 3. Backend Servisi Çökmüş
**Kontrol:** Railway Dashboard → Backend Service → Logs

**Aranan hatalar:**
- `Connection refused`
- `MongoDB connection failed`
- `Module not found`

### 4. Frontend Backend URL'si Yanlış
**Kontrol:** Railway Frontend Variables:
```env
REACT_APP_BACKEND_URL=https://galeri.mactech.tr
```

**YANLIŞ örnekler:**
```
❌ http://galeri.mactech.tr (http olmamalı)
❌ https://galeri.mactech.tr/ (sonda / olmamalı)
❌ localhost:8001
❌ https://backend-service-name.railway.app (frontend domain olmalı)
```

---

## 🎯 SSO ile Otomatik Giriş (Gelecek)

Websitenizdeki kullanıcılar galeri uygulamasına kayıt olmadan giriş yapabilsin isterseniz:

### Yapılması Gerekenler:

1. **mactech.tr'de SSO API Oluşturun:**
```
POST https://mactech.tr/api/platform/sso/verify
```

2. **Request Format:**
```json
{
  "sso_token": "xxx"
}
```

3. **Response Format:**
```json
{
  "valid": true,
  "user": {
    "mactech_id": "mtc_12345",
    "email": "user@example.com",
    "full_name": "Ali Veli",
    "phone": "+90 555 123 4567"
  }
}
```

4. **SSO Akışı:**
```
mactech.tr (giriş) 
  → SSO token oluştur
  → galeri.mactech.tr/sso-callback?sso_token=xxx
  → Backend token'ı doğrular
  → JWT verir
  → Dashboard'a giriş yapar
```

**Galeri uygulaması SSO için hazır!** API'yi oluşturun, hemen çalışacak.

---

## 📞 Hala Çalışmıyorsa

### 1. Backend Loglarını Paylaşın
Railway Dashboard → Backend Service → "View Logs" → Son 50 satır

### 2. Browser Console Hatalarını Paylaşın
F12 → Console sekmesi → Hataları kopyalayın

### 3. Environment Variables Ekran Görüntüsü
Railway Dashboard → Variables (hassas bilgileri sansürleyin)

---

## 🎬 Hızlı Başlangıç Özeti

**ŞU AN İÇİN:**
1. ✅ galeri.mactech.tr'ye gidin
2. ✅ Kayıt olun (websitenizdeki aynı e-posta ile)
3. ✅ Giriş yapın

**KALICI ÇÖZÜM:**
1. ⏳ mactech.tr'de SSO API'si oluşturun
2. ✅ Galeri uygulaması SSO için hazır
3. 🎯 Websitesinden otomatik giriş çalışacak

---

**Son Güncelleme:** 5 Nisan 2026
