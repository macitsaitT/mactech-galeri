# Railway Environment Variables Kontrol Listesi

## 🚨 SORUN: "Invalid contents" hatası

## ✅ HIZLI ÇÖZÜM
**Galeri uygulamasına kayıt olun!**

Websitenizdeki e-posta ile galeri uygulamasına kayıt olmadığınız için giriş yapamıyorsunuz.

1. https://galeri.mactech.tr
2. "Kayıt olun" → Websitenizdeki e-posta ile kayıt olun
3. Giriş yapın ✅

---

## 🔧 Railway Kontrol Adımları

### Backend Service Variables

Railway Dashboard → Backend Service → Variables:

```env
MONGO_URL=mongodb+srv://[user]:[pass]@[cluster].mongodb.net/[db]?retryWrites=true&w=majority
DB_NAME=galeri_crm
CORS_ORIGINS=*
```

### Frontend Service Variables

Railway Dashboard → Frontend Service → Variables:

```env
REACT_APP_BACKEND_URL=https://galeri.mactech.tr
```

⚠️ **DİKKAT:**
- Sonunda `/` YOK
- `https://` ile başlar
- Domain adınızı kullanın

---

## 🧪 Test Komutları

### 1. Backend Çalışıyor mu?
```bash
curl https://galeri.mactech.tr/api/health
```
**Beklenen:** `{"status":"healthy"}`

### 2. CORS Ayarları Doğru mu?
```bash
curl -I https://galeri.mactech.tr/api/health
```
**Aranan:** `Access-Control-Allow-Origin: *`

### 3. Login Endpoint Çalışıyor mu?
```bash
curl -X POST https://galeri.mactech.tr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123"}'
```
**Beklenen:** `{"detail":"Invalid credentials"}` (kullanıcı olmadığı için)

---

## 🔍 Browser Console Kontrolü (F12)

1. **F12** tuşuna basın
2. **Console** sekmesi:
   - Kırmızı hatalar var mı?
   - "CORS" hatası var mı?

3. **Network** sekmesi:
   - Login isteğine tıklayın
   - **Status:** 401 olmalı (kullanıcı yoksa)
   - **Response:** `{"detail":"Invalid credentials"}` olmalı

**Eğer Status 502, 503, 504 ise → Backend çalışmıyor**
**Eğer Response HTML ise → Backend yanıt vermiyor**

---

## 📊 Railway Services Yapılandırması

### Backend Service

**Root Directory:** `/app/backend`  
**Start Command:** `uvicorn server:app --host 0.0.0.0 --port 8001`  
**Port:** 8001

### Frontend Service

**Root Directory:** `/app/frontend`  
**Build Command:** `yarn build`  
**Start Command:** `yarn serve`  
**Port:** 3000

---

## 🆘 Sorun Devam Ederse

### Railway Logs

**Backend logs:**
Railway → Backend Service → View Logs

**Aranan hatalar:**
- `MongoDB connection failed`
- `Module not found`
- `Port already in use`

**Frontend logs:**
Railway → Frontend Service → View Logs

**Aranan hatalar:**
- `Build failed`
- `Missing dependencies`

---

## 🎯 SSO İle Otomatik Giriş (Gelecek)

Websitenizdeki kullanıcılar otomatik galeri'ye girsin isterseniz:

1. `mactech.tr/api/platform/sso/verify` API'sini oluşturun
2. Galeri uygulaması SSO için hazır!
3. Websitenizden otomatik giriş çalışacak

---

**ŞİMDİLİK:** Galeri uygulamasına kayıt olun ✅  
**GELECEK:** SSO API'si hazır olunca otomatik giriş çalışacak 🚀
