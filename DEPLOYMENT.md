# 🚀 Vercel Deployment Checklist

## ✅ Ön Kontroller

### 1. Environment Variables (Vercel Dashboard)
```
BOT_TOKEN=your_actual_telegram_bot_token
WORKER_URL=https://one.1sec-one-system.workers.dev
```

### 2. Dosya Yapısı Kontrolü
- ✅ `api/index.js` - API endpoint
- ✅ `index.html` - Ana sayfa  
- ✅ `vercel.json` - Vercel yapılandırması
- ✅ `package.json` - Dependencies

### 3. Vercel Dashboard Ayarları
- **Framework Preset**: Other
- **Root Directory**: `./` (kök dizin)
- **Build Command**: `npm run build`
- **Output Directory**: `./` (kök dizin)
- **Install Command**: `npm install`

## 🔧 Deployment Adımları

### 1. GitHub ile Otomatik Deployment
```bash
# 1. Projeyi GitHub'a push edin
git add .
git commit -m "Vercel deployment hazırlığı"
git push origin main

# 2. Vercel dashboard'da GitHub repo'yu bağlayın
# 3. Environment variables'ları ekleyin
# 4. Deploy butonuna tıklayın
```

### 2. Vercel CLI ile Manuel Deployment
```bash
# 1. Vercel CLI kurulumu
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

## 🧪 Test Adımları

### 1. Ana Sayfa Testi
```
GET https://your-app.vercel.app/
Beklenen: HTML sayfası (200 OK)
```

### 2. API Endpoint Testi
```
POST https://your-app.vercel.app/api
Content-Type: application/json

{
  "message": {
    "chat": {"id": 123456},
    "text": "btc 1h"
  }
}
Beklenen: JSON response (200 OK)
```

### 3. CORS Testi
```javascript
fetch('https://your-app.vercel.app/api', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({test: true})
})
```

## 🐛 Sorun Giderme

### 404 Hatası
- ✅ Environment variables kontrol edin
- ✅ vercel.json yapılandırması kontrol edin
- ✅ Build logs kontrol edin
- ✅ Function logs kontrol edin

### 500 Hatası
- ✅ Console logs kontrol edin
- ✅ Environment variables eksikliği kontrol edin
- ✅ Worker URL erişilebilirliği kontrol edin

### CORS Hatası
- ✅ Headers yapılandırması kontrol edin
- ✅ OPTIONS method handling kontrol edin
