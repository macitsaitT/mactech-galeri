# MacTech.tr Webhook Implementasyonu

## 🎯 Amaç
Kullanıcı mactech.tr'de trial/abonelik başlattığında, Galeri CRM'e otomatik kullanıcı oluşturulması.

---

## 📍 Webhook Endpoint
```
POST https://galeri.mactech.tr/api/webhooks/app-access
Content-Type: application/json
```

---

## 📦 Payload Formatı

### Trial Başlatma (trial.started)
```json
{
  "event": "trial.started",
  "user": {
    "mactech_id": "mt_12345",
    "email": "macitsaitufuk@gmail.com",
    "full_name": "Macit Sait Ufuk",
    "phone": "05321234567"
  },
  "galeri_access": {
    "trial_active": true,
    "trial_start": "2026-04-14T12:00:00Z",
    "trial_end": "2026-04-28T12:00:00Z",
    "subscription": "trial",
    "payment_status": "",
    "payment_frequency": ""
  }
}
```

### Abonelik Başlatma (subscription.created)
```json
{
  "event": "subscription.created",
  "user": {
    "mactech_id": "mt_12345",
    "email": "macitsaitufuk@gmail.com",
    "full_name": "Macit Sait Ufuk",
    "phone": "05321234567"
  },
  "galeri_access": {
    "trial_active": false,
    "subscription": "pro",
    "payment_status": "active",
    "payment_frequency": "monthly",
    "subscription_end_date": "2026-05-14T12:00:00Z"
  }
}
```

### Abonelik İptali (subscription.cancelled)
```json
{
  "event": "subscription.cancelled",
  "user": {
    "mactech_id": "mt_12345",
    "email": "macitsaitufuk@gmail.com"
  },
  "galeri_access": {
    "trial_active": false,
    "subscription": "free",
    "payment_status": "cancelled"
  }
}
```

---

## 💻 Python/Django/Flask Kod Örneği

### Django Örneği
```python
import requests
from datetime import datetime, timedelta

def send_galeri_webhook(user, event_type):
    """Galeri CRM'e webhook gönder"""
    
    webhook_url = "https://galeri.mactech.tr/api/webhooks/app-access"
    
    # Trial başlangıç/bitiş hesapla
    if event_type == "trial.started":
        trial_start = datetime.utcnow()
        trial_end = trial_start + timedelta(days=14)
        
        payload = {
            "event": event_type,
            "user": {
                "mactech_id": f"mt_{user.id}",
                "email": user.email,
                "full_name": user.get_full_name(),
                "phone": user.phone or ""
            },
            "galeri_access": {
                "trial_active": True,
                "trial_start": trial_start.isoformat() + "Z",
                "trial_end": trial_end.isoformat() + "Z",
                "subscription": "trial",
                "payment_status": "",
                "payment_frequency": ""
            }
        }
    
    elif event_type == "subscription.created":
        subscription_end = datetime.utcnow() + timedelta(days=30)  # veya user.subscription_end
        
        payload = {
            "event": event_type,
            "user": {
                "mactech_id": f"mt_{user.id}",
                "email": user.email,
                "full_name": user.get_full_name(),
                "phone": user.phone or ""
            },
            "galeri_access": {
                "trial_active": False,
                "subscription": "pro",  # veya user.subscription_type
                "payment_status": "active",
                "payment_frequency": user.payment_frequency,  # "monthly" veya "yearly"
                "subscription_end_date": subscription_end.isoformat() + "Z"
            }
        }
    
    # Webhook gönder
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Galeri webhook başarılı: {user.email}")
            return True
        else:
            print(f"❌ Galeri webhook hatası: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Galeri webhook exception: {e}")
        return False


# KULLANIM ÖRNEKLERİ:

# 1. Trial başlatma
def start_trial(user):
    user.trial_active = True
    user.trial_start = datetime.utcnow()
    user.trial_end = user.trial_start + timedelta(days=14)
    user.save()
    
    # Galeri CRM'e webhook gönder
    send_galeri_webhook(user, "trial.started")


# 2. Abonelik oluşturma
def create_subscription(user, payment_frequency):
    user.subscription = "pro"
    user.payment_frequency = payment_frequency
    user.payment_status = "active"
    user.save()
    
    # Galeri CRM'e webhook gönder
    send_galeri_webhook(user, "subscription.created")


# 3. Abonelik iptali
def cancel_subscription(user):
    user.subscription = "free"
    user.payment_status = "cancelled"
    user.save()
    
    # Galeri CRM'e webhook gönder
    send_galeri_webhook(user, "subscription.cancelled")
```

### Flask Örneği
```python
from flask import current_app
import requests
from datetime import datetime, timedelta

@app.route('/start-trial', methods=['POST'])
def start_trial():
    user = get_current_user()
    
    # Trial bilgileri
    trial_start = datetime.utcnow()
    trial_end = trial_start + timedelta(days=14)
    
    # Database güncelle
    user.trial_active = True
    user.trial_start = trial_start
    user.trial_end = trial_end
    db.session.commit()
    
    # Galeri CRM'e webhook gönder
    webhook_payload = {
        "event": "trial.started",
        "user": {
            "mactech_id": f"mt_{user.id}",
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone
        },
        "galeri_access": {
            "trial_active": True,
            "trial_start": trial_start.isoformat() + "Z",
            "trial_end": trial_end.isoformat() + "Z",
            "subscription": "trial"
        }
    }
    
    try:
        response = requests.post(
            "https://galeri.mactech.tr/api/webhooks/app-access",
            json=webhook_payload,
            timeout=10
        )
        current_app.logger.info(f"Webhook response: {response.status_code}")
    except Exception as e:
        current_app.logger.error(f"Webhook error: {e}")
    
    return {"success": True, "message": "Trial başlatıldı"}
```

---

## 🧪 Test Etme

### 1. cURL ile Manuel Test
```bash
curl -X POST https://galeri.mactech.tr/api/webhooks/app-access \
  -H "Content-Type: application/json" \
  -d '{
    "event": "trial.started",
    "user": {
      "mactech_id": "mt_test_123",
      "email": "test@test.com",
      "full_name": "Test User",
      "phone": "05321234567"
    },
    "galeri_access": {
      "trial_active": true,
      "trial_start": "2026-04-14T12:00:00Z",
      "trial_end": "2026-04-28T12:00:00Z",
      "subscription": "trial"
    }
  }'
```

### 2. Python ile Test
```python
import requests
from datetime import datetime, timedelta

webhook_url = "https://galeri.mactech.tr/api/webhooks/app-access"

trial_start = datetime.utcnow()
trial_end = trial_start + timedelta(days=14)

test_payload = {
    "event": "trial.started",
    "user": {
        "mactech_id": "mt_test_456",
        "email": "macitsaitufuk@gmail.com",
        "full_name": "Macit Sait Ufuk",
        "phone": "05321234567"
    },
    "galeri_access": {
        "trial_active": True,
        "trial_start": trial_start.isoformat() + "Z",
        "trial_end": trial_end.isoformat() + "Z",
        "subscription": "trial",
        "payment_status": "",
        "payment_frequency": ""
    }
}

response = requests.post(webhook_url, json=test_payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

Başarılı yanıt:
```json
{
  "success": true,
  "message": "User created/updated successfully"
}
```

---

## 📌 ÖNEMLİ NOTLAR

1. **mactech_id** benzersiz olmalı (örn: `mt_12345`)
2. **Tarihler ISO 8601 formatında** olmalı (`2026-04-14T12:00:00Z`)
3. **Trial süresi 14 gün** olmalı
4. **Webhook asenkron çalışabilir** (başarısız olsa bile kullanıcıya hata göstermeyin)
5. **Retry mekanizması** ekleyin (webhook başarısız olursa 3 kez tekrar deneyin)

---

## 🔍 Troubleshooting

### Webhook 404 hatası alıyorsa:
- URL doğru mu? `https://galeri.mactech.tr/api/webhooks/app-access`
- CRM deployment çalışıyor mu?

### Kullanıcı oluşmuyorsa:
- Payload formatı doğru mu?
- `mactech_id` ve `email` gönderildi mi?
- CRM loglarını kontrol edin

### SSO ile çakışma olursa:
- Webhook öncelikli olmalı
- SSO sadece fallback olarak çalışır
