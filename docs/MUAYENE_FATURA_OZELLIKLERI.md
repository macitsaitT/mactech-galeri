# Muayene Tarihi ve Fatura Özellikleri - Uygulama Rehberi

## 🎯 Yeni Özellikler

### 1️⃣ Muayene Tarihi Takibi
- Araç eklerken muayene tarihi ve bildirim gün sayısı ayarlanabilir
- Muayene tarihi yaklaşan araçlar için otomatik bildirimler (push + uygulama içi)
- Sidebar'da "Muayene Takibi" menüsü
- Ayrı muayene takip sayfası

### 2️⃣ Faturalı/Faturasız Alım
- Araç eklerken "Faturalı Alım" checkbox'ı
- Faturalı seçilince fatura bilgileri zorunlu
- Faturasız seçilince ekstra bilgi gerekmez

### 3️⃣ Fatura Bilgileri ve PDF
- Fatura numarası, tarih, satıcı bilgileri
- PDF olarak fatura görüntüleme ve yazdırma
- Türkiye standartlarına uygun fatura şablonu

---

## 📁 Değiştirilen Dosyalar

### Backend
1. **`/app/backend/models.py`**
   - `CarBase` modeline yeni field'lar eklendi:
     - `inspection_date`: Muayene tarihi
     - `inspection_notification_days`: Bildirim gün sayısı (varsayılan 30)
     - `is_invoiced`: Faturalı alım mı?
     - `invoice_number`: Fatura numarası
     - `invoice_date`: Fatura tarihi
     - `invoice_seller_name`: Satıcı adı
     - `invoice_seller_tax_id`: TC/Vergi numarası
     - `invoice_seller_address`: Satıcı adresi

2. **`/app/backend/routes/cars.py`**
   - Yeni endpoint: `GET /api/inspection-due`
   - Muayene tarihi yaklaşan araçları getirir
   - Her aracın kendi bildirim gününe göre filtreleme

3. **`/app/backend/routes/invoices.py`** (YENİ)
   - `GET /api/invoices/{car_id}` endpoint'i
   - Türk fatura standardına uygun HTML/PDF şablonu
   - KDV hesaplama (%20)
   - Yazdırılabilir format

4. **`/app/backend/server.py`**
   - `invoices_router` eklendi

### Frontend
5. **`/app/frontend/src/components/modals/AddCarModal.jsx`**
   - Muayene tarihi inputu
   - Bildirim gün sayısı dropdown (7, 15, 30, 45, 60 gün)
   - "Faturalı Alım" checkbox
   - Fatura bilgileri form alanları (conditional)
   - Form validasyonu (faturalı seçilince zorunlu)

6. **`/app/frontend/src/pages/InspectionPage.jsx`** (YENİ)
   - Muayene tarihi yaklaşan araçlar listesi
   - Renk kodlu durum kartları:
     - Kırmızı: Bugün
     - Turuncu: 0-7 gün
     - Sarı: 8-15 gün
     - Mavi: 16+ gün
   - Fatura görüntüleme butonu

7. **`/app/frontend/src/utils/notifications.js`**
   - `checkInspectionDates(cars)` fonksiyonu
   - Muayene tarihi bildirim mantığı
   - 3 durum:
     - Yaklaşıyor: Bildirim gününden önce
     - Bugün: Muayene tarihi bugün
     - Geçmiş: Muayene tarihi geçti

8. **`/app/frontend/src/App.js`**
   - `InspectionPage` import ve route
   - Notification servisi güncellemesi (cars parametresi)
   - View title: 'Muayene Takibi'

9. **`/app/frontend/src/components/layout/Sidebar.jsx`**
   - Yeni menü: "Muayene Takibi" (Wrench icon)

10. **`/app/frontend/src/services/api.js`**
    - `carsAPI.getInspectionDue()` 
    - `invoicesAPI.getInvoiceHtml(carId)`

---

## 🔧 Kullanım

### Araç Eklerken
1. Genel Bilgiler sekmesinde:
   - Muayene tarihini seçin
   - Bildirim gününü ayarlayın (örn: 30 gün önce)
2. Fiyat bölümünün üstünde:
   - "Faturalı Alım" checkbox'ını işaretleyin
   - Fatura bilgilerini doldurun:
     - Fatura No
     - Fatura Tarihi
     - Satıcı Adı/Firma
     - TC/Vergi No
     - Satıcı Adresi

### Muayene Takibi
1. Sidebar'dan "Muayene Takibi" menüsüne tıklayın
2. Yaklaşan araçları görün
3. "Fatura Görüntüle" butonuna tıklayarak PDF'i açın

### Bildirimler
- Uygulama açıkken her 5 dakikada kontrol edilir
- Muayene tarihi geldiğinde push notification
- Uygulama içi zil ikonunda bildirim görünür

---

## 📊 API Endpoint'leri

### Muayene Tarihi
```
GET /api/inspection-due
Authorization: Bearer {token}

Response:
[
  {
    "id": "xxx",
    "brand": "Toyota",
    "model": "Corolla",
    "plate": "34ABC123",
    "inspection_date": "2024-05-15",
    "inspection_notification_days": 30,
    "days_until_inspection": 10,
    ...
  }
]
```

### Fatura Görüntüleme
```
GET /api/invoices/{car_id}
Authorization: Bearer {token}

Response: HTML/PDF (yazdırılabilir)
```

---

## 🎨 Fatura Şablonu Özellikleri

- ✅ Türkiye standartlarına uygun
- ✅ Satıcı ve alıcı bilgileri
- ✅ Fatura numarası ve tarihi
- ✅ Araç detayları (marka, model, plaka, km, vb.)
- ✅ KDV hesaplama (%20)
- ✅ Ara toplam ve genel toplam
- ✅ Yazdırma butonu
- ✅ MACTech branding

---

## 🧪 Test Senaryoları

### 1. Faturalı Araç Ekleme
- Araç ekle → Faturalı Alım işaretle
- Fatura bilgilerini doldur
- Kaydet
- Muayene sayfasına git
- "Fatura Görüntüle" butonuna tıkla
- PDF açılmalı ✅

### 2. Faturasız Araç Ekleme
- Araç ekle → Faturalı Alım işaretleme
- Fatura alanları görünmemeli ✅
- Kaydet

### 3. Fatura Validasyonu
- Araç ekle → Faturalı Alım işaretle
- Fatura bilgilerini BOŞ bırak
- Kaydet'e tıkla
- Hata mesajları görünmeli ✅

### 4. Muayene Bildirimleri
- Muayene tarihi yakın araç ekle
- 5 dakika bekle
- Bildirim gelm eli ✅

### 5. Muayene Sayfası
- Sidebar → Muayene Takibi
- Yaklaşan araçlar listelenmeli
- Renk kodları doğru olmalı ✅

---

## 📝 Notlar

- Fatura tutarı = Alış fiyatı (KDV hariç)
- KDV oranı: %20 (motorlu taşıtlar)
- Muayene bildirim kontrolü: Her 5 dakika
- Bildirimler duplike edilmez (aynı gün sadece 1 kez)
- Faturasız alımlarda invoice field'ları boş kalır

---

**Oluşturulma:** 5 Nisan 2026  
**Durum:** ✅ Tamamlandı, test bekliyor
