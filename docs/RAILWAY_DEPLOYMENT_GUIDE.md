# Railway Deployment Rehberi - MACTech Oto Galeri CRM

## 🚀 Railway'de Başarılı Deployment İçin Kontrol Listesi

### 1. Environment Variables (Ortam Değişkenleri)

Railway dashboard'unuzda şu değişkenlerin **mutlaka** doğru ayarlandığından emin olun:

#### Frontend Environment Variables
```env
REACT_APP_BACKEND_URL=https://galeri.mactech.tr
```
**ÖNEMLİ:** 
- Sonunda `/` olmamalı
- `https://` ile başlamalı
- Tam domain adınızı yazın

#### Backend Environment Variables
```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/galeri_crm?retryWrites=true&w=majority
DB_NAME=galeri_crm
CORS_ORIGINS=*
```

**MONGO_URL için:**
- Railway'deki MongoDB plugin kullanıyorsanız otomatik eklenir
- Dış MongoDB (Atlas vb.) kullanıyorsanız connection string'inizi ekleyin
- Connection string'de özel karakterler varsa encode edin

### 2. Railway Services Yapılandırması

Projenizde 2 adet service olmalı:

#### Backend Service
- **Root Directory:** `/app/backend`
- **Start Command:** `uvicorn server:app --host 0.0.0.0 --port 8001`
- **Port:** 8001

#### Frontend Service
- **Root Directory:** `/app/frontend`
- **Build Command:** `yarn build`
- **Start Command:** `yarn serve`
- **Port:** 3000

### 3. Domain Ayarları

Railway dashboard'da:
1. Frontend service'e tıklayın
2. "Settings" → "Domains" bölümüne gidin
3. Custom domain ekleyin: `galeri.mactech.tr`

#### DNS Ayarları (Domain sağlayıcınızda)
```
Type: CNAME
Name: galeri
Value: [Railway tarafından verilen domain].railway.app
TTL: Auto veya 3600
```

**Not:** DNS yayılması 5-48 saat sürebilir.

## 🔍 Sorun Giderme

### Sorun 1: "Uygulamaya giriş yapılamıyor"

**Olası Nedenler ve Çözümler:**

#### A) CORS Hatası
**Kontrol:**
```bash
# Browser console'da (F12) şu hatayı görüyorsanız:
"Access to XMLHttpRequest has been blocked by CORS policy"
```

**Çözüm:**
1. Backend service'inizde `CORS_ORIGINS` değişkenini kontrol edin
2. `CORS_ORIGINS=*` olarak ayarlayın
3. Service'i yeniden deploy edin

#### B) Backend URL Yanlış
**Kontrol:**
1. Frontend service Environment Variables'da `REACT_APP_BACKEND_URL` değerini kontrol edin
2. Browser console'da (F12) Network tab'ine bakın
3. API istekleri nereye gidiyor kontrol edin

**Çözüm:**
```env
# Doğru format:
REACT_APP_BACKEND_URL=https://galeri.mactech.tr

# YANLIŞ formatlar:
REACT_APP_BACKEND_URL=https://galeri.mactech.tr/
REACT_APP_BACKEND_URL=http://galeri.mactech.tr
REACT_APP_BACKEND_URL=localhost:8001
```

#### C) MongoDB Bağlantı Hatası
**Kontrol:**
Backend logs'larında şunu görüyorsanız:
```
Error connecting to MongoDB
```

**Çözüm:**
1. `MONGO_URL` değişkenini kontrol edin
2. MongoDB Atlas'ta IP whitelist'e `0.0.0.0/0` ekleyin (production'da specific IP kullanın)
3. Connection string'deki username/password'u kontrol edin

### Sorun 2: "Beyaz Ekran" veya "Application Error"

**Kontrol Adımları:**

1. **Build Loglarını Kontrol Edin**
   - Railway dashboard → Frontend service → Deployments
   - Son deployment'ın loglarını inceleyin
   - Hata mesajı varsa not edin

2. **Runtime Loglarını Kontrol Edin**
   - Railway dashboard → Frontend service → "View Logs"
   - Canlı logları izleyin

**Çözüm:**
```bash
# Eğer "missing dependency" hatası varsa:
# package.json'da eksik paket olabilir

# Eğer "memory exceeded" hatası varsa:
# Railway plan'ınızı yükseltin veya build optimize edin
```

### Sorun 3: "SSL/HTTPS Güvenlik Uyarısı"

**Durum:** "Bağlantınız güvenli değil" uyarısı

**Açıklama:**
- Railway otomatik SSL sertifikası sağlar
- Ancak custom domain eklendikten sonra 5-10 dakika beklemek gerekir
- DNS yayılması tamamlanmadan SSL aktif olmaz

**Çözüm:**
1. DNS ayarlarınızın doğru olduğundan emin olun
2. 10-15 dakika bekleyin
3. Hala devam ederse Railway support ile iletişime geçin

### Sorun 4: "Frontend-Backend Haberleşemiyor"

**Debug Adımları:**

1. **Browser Console'da Network İsteklerini İnceleyin:**
```javascript
// F12 → Network
// Login butonuna tıklayın
// İstek nereye gidiyor?
// Status code nedir? (401, 404, 500, CORS error?)
```

2. **Backend'in Erişilebilir Olduğunu Test Edin:**
```bash
# Terminal veya Postman'de:
curl https://galeri.mactech.tr/api/health

# Başarılı yanıt:
{"status": "healthy"}
```

3. **CORS Header'ları Kontrol Edin:**
```bash
curl -I https://galeri.mactech.tr/api/health

# Şu header olmalı:
Access-Control-Allow-Origin: *
```

## 📝 Deployment Checklist

Deploy etmeden önce şunları kontrol edin:

- [ ] `REACT_APP_BACKEND_URL` doğru ayarlandı (frontend)
- [ ] `MONGO_URL` doğru ayarlandı (backend)
- [ ] `CORS_ORIGINS=*` ayarlandı (backend)
- [ ] Frontend build komutu: `yarn build`
- [ ] Frontend start komutu: `yarn serve`
- [ ] Backend start komutu: `uvicorn server:app --host 0.0.0.0 --port 8001`
- [ ] Custom domain eklendi
- [ ] DNS ayarları yapıldı
- [ ] SSL sertifikası aktif (10-15 dk sonra)

## 🧪 Deployment Sonrası Test

1. **Health Check:**
```bash
curl https://galeri.mactech.tr/api/health
```

2. **Frontend Erişimi:**
```
https://galeri.mactech.tr
```

3. **Login Testi:**
- Test kullanıcısı ile giriş yapın
- Dashboard'un yüklendiğini kontrol edin
- Araç ekleme/görüntüleme test edin

## 🆘 Hala Çalışmıyorsa

### Railway Loglarını Paylaşın

1. **Backend Logs:**
```
Railway Dashboard → Backend Service → "View Logs"
→ Son 50 satırı kopyalayın
```

2. **Frontend Logs:**
```
Railway Dashboard → Frontend Service → "View Logs"
→ Son 50 satırı kopyalayın
```

3. **Browser Console Logs:**
```
F12 → Console → Hata mesajlarını kopyalayın
F12 → Network → Başarısız istekleri kopyalayın
```

### Environment Variables'ı Ekran Görüntüsü İle Paylaşın

- Railway Dashboard → Frontend Service → Variables (hassas bilgileri sansürleyin)
- Railway Dashboard → Backend Service → Variables (hassas bilgileri sansürleyin)

## 📊 Önerilen Railway Plan

**Hobby Plan** (Küçük-orta ölçek için):
- 500 saat/ay
- 512MB RAM
- Shared CPU
- Aylık ~$5

**Pro Plan** (Yoğun kullanım için):
- Unlimited saat
- 8GB RAM'e kadar
- Priority support
- Aylık ~$20+

## 🔐 Güvenlik Önerileri

### Production İçin:

1. **CORS Ayarları:**
```env
# Development:
CORS_ORIGINS=*

# Production:
CORS_ORIGINS=https://galeri.mactech.tr,https://www.mactech.tr
```

2. **MongoDB Güvenliği:**
- IP whitelist kullanın
- Güçlü şifreler kullanın
- Read-only kullanıcılar oluşturun (gerekirse)

3. **Environment Variables:**
- Hassas bilgileri asla kod içinde saklamayın
- Railway secrets kullanın

---

**Son Güncelleme:** 5 Nisan 2026  
**Durum:** ✅ Kod Railway-ready
