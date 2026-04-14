# MACTech Galeri CRM - Deployment Rehberi

## 🎯 Sistem Özellikleri

**Tamamen MacTech Bağımsız Sistem:**
- ✅ Emergent bağımlılığı YOK
- ✅ Kendi domain: galeri.mactech.tr
- ✅ Kendi storage sistemi (local file system)
- ✅ MacTech SSO entegrasyonu
- ✅ MacTech Webhook sistemi

---

## 📦 Gereksinimler

### Backend
- Python 3.11+
- MongoDB 5.0+
- Node.js 18+ (frontend build için)

### Frontend
- Node.js 18+
- Yarn package manager

---

## 🚀 Deployment Seçenekleri

### Seçenek 1: Railway Deployment (ÖNERİLEN)

#### 1. Backend Deployment

**Railway Project Oluştur:**
```bash
# Railway CLI install
npm install -g @railway/cli

# Login
railway login

# Yeni proje oluştur
railway init
```

**Environment Variables (.env):**
```bash
# MongoDB
MONGO_URL=mongodb://user:password@mongo-host:27017
DB_NAME=mactech_galeri_crm

# CORS
CORS_ORIGINS=https://galeri.mactech.tr

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Storage
PUBLIC_STORAGE_URL=https://galeri-backend.mactech.tr/uploads

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

**Procfile (Backend):**
```
web: cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT
```

**railway.json:**
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r backend/requirements.txt"
  },
  "deploy": {
    "startCommand": "cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 2. MongoDB Deployment

**Railway MongoDB Plugin:**
```bash
railway add -d mongodb

# Otomatik MONGO_URL alırsınız
```

**VEYA Kendi MongoDB:**
- MongoDB Atlas (cloud.mongodb.com)
- DigitalOcean Managed MongoDB
- Kendi sunucunuzda MongoDB

#### 3. Frontend Deployment

**Vercel Deployment:**
```bash
# Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

**Environment Variable (Vercel):**
```
REACT_APP_BACKEND_URL=https://galeri-backend.mactech.tr
```

**VEYA Netlify:**
```bash
# Build
cd frontend
yarn build

# Deploy
netlify deploy --prod --dir=build
```

---

### Seçenek 2: VPS Deployment (DigitalOcean, Hetzner, vb.)

#### 1. Sunucu Kurulumu

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.11 python3-pip nginx mongodb nodejs npm

# Install yarn
npm install -g yarn

# Install PM2
npm install -g pm2
```

#### 2. MongoDB Kurulumu

```bash
# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Create database user
mongo
> use admin
> db.createUser({
    user: "mactech_admin",
    pwd: "strong_password",
    roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
  })
```

#### 3. Backend Deployment

```bash
# Clone veya upload
cd /var/www
git clone your-repo.git mactech-galeri
cd mactech-galeri/backend

# Virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Environment variables
cp .env.example .env
nano .env  # Düzenle

# PM2 ile başlat
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name mactech-backend
pm2 save
pm2 startup
```

#### 4. Frontend Build & Deploy

```bash
cd /var/www/mactech-galeri/frontend

# Install dependencies
yarn install

# Build
REACT_APP_BACKEND_URL=https://galeri.mactech.tr yarn build

# Nginx'e kopyala
sudo cp -r build/* /var/www/html/galeri/
```

#### 5. Nginx Konfigürasyonu

**/etc/nginx/sites-available/galeri.mactech.tr:**
```nginx
# Frontend
server {
    listen 80;
    listen 443 ssl http2;
    server_name galeri.mactech.tr;

    ssl_certificate /etc/letsencrypt/live/galeri.mactech.tr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/galeri.mactech.tr/privkey.pem;

    root /var/www/html/galeri;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static uploads
    location /uploads/ {
        alias /app/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Aktifleştir:**
```bash
sudo ln -s /etc/nginx/sites-available/galeri.mactech.tr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. SSL Sertifikası

```bash
# Certbot install
sudo apt install certbot python3-certbot-nginx

# SSL al
sudo certbot --nginx -d galeri.mactech.tr

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 🔧 Konfigürasyon

### Backend .env

```bash
# Database
MONGO_URL=mongodb://user:password@localhost:27017
DB_NAME=mactech_galeri_crm

# Security
JWT_SECRET=your-random-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-byte-base64-encryption-key

# CORS
CORS_ORIGINS=https://galeri.mactech.tr,https://www.galeri.mactech.tr

# Storage
PUBLIC_STORAGE_URL=https://galeri.mactech.tr/uploads

# Optional: MacTech Integration
MACTECH_API_URL=https://www.mactech.tr/api
```

### Frontend .env

```bash
REACT_APP_BACKEND_URL=https://galeri.mactech.tr
```

---

## 📊 Monitoring & Logs

### PM2 Logs (VPS)
```bash
# Backend logs
pm2 logs mactech-backend

# Monitoring
pm2 monit
```

### Railway Logs
```bash
railway logs
```

### Nginx Logs
```bash
# Access log
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔐 Güvenlik

### 1. Firewall (UFW)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. MongoDB Güvenliği
```bash
# MongoDB config
sudo nano /etc/mongodb.conf

# Bind to localhost only
bind_ip = 127.0.0.1

# Enable authentication
security:
  authorization: enabled
```

### 3. Fail2Ban (Brute Force Protection)
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## 📦 Backup

### MongoDB Backup
```bash
# Manual backup
mongodump --uri="mongodb://user:password@localhost:27017/mactech_galeri_crm" --out=/backups/$(date +%Y%m%d)

# Automated daily backup (crontab)
0 2 * * * /usr/bin/mongodump --uri="mongodb://..." --out=/backups/$(date +\%Y\%m\%d)
```

### Upload Files Backup
```bash
# Rsync backup
rsync -avz /app/uploads/ /backups/uploads/

# Crontab
0 3 * * * rsync -avz /app/uploads/ /backups/uploads/
```

---

## 🧪 Test & Verify

### 1. Backend Health Check
```bash
curl https://galeri.mactech.tr/api/health
# Expected: {"status":"healthy"}
```

### 2. Webhook Test
```bash
curl -X POST https://galeri.mactech.tr/api/webhooks/app-access \
  -H "Content-Type: application/json" \
  -d '{
    "event": "trial.started",
    "user": {
      "mactech_id": "mt_test_001",
      "email": "test@example.com",
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

### 3. Frontend Test
```bash
# Homepage
curl -I https://galeri.mactech.tr
# Expected: 200 OK

# Build check
ls -la /var/www/html/galeri/
```

---

## 🚨 Troubleshooting

### Backend başlamıyor
```bash
# Logs kontrol
pm2 logs mactech-backend --lines 100

# MongoDB bağlantısı test
mongo --eval "db.runCommand({ connectionStatus: 1 })"
```

### Frontend boş sayfa
```bash
# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Build yeniden oluştur
cd frontend && yarn build
```

### Webhook çalışmıyor
```bash
# Backend logs
pm2 logs mactech-backend | grep webhook

# Endpoint test
curl -X POST http://localhost:8001/api/webhooks/app-access -H "Content-Type: application/json" -d '{...}'
```

---

## 📞 Destek

Sorun yaşarsanız:
1. Logs kontrol edin (pm2 logs / railway logs)
2. Environment variables doğru mu?
3. MongoDB bağlantısı çalışıyor mu?
4. Nginx config doğru mu?

**Önemli:** Deployment sonrası mactech.tr webhook URL'ini güncelleyin:
```
https://galeri.mactech.tr/api/webhooks/app-access
```
