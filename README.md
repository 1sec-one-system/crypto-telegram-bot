# 🤖 1Sec One Telegram Bot

Telegram bot API endpoint'i Vercel üzerinde çalışan bir proje.

## 🚀 Vercel Deployment

### 1. Environment Variables Ayarla
Vercel dashboard'da aşağıdaki environment variables'ları ekleyin:

```bash
BOT_TOKEN=your_telegram_bot_token_here
WORKER_URL=https://one.1sec-one-system.workers.dev
```

### 2. Deployment
```bash
# Vercel CLI ile
vercel --prod

# Veya GitHub ile otomatik deployment
```

### 3. API Endpoints
- **Ana Sayfa**: `https://your-app.vercel.app/`
- **API Endpoint**: `https://your-app.vercel.app/api`

## 🔧 Yerel Geliştirme

```bash
npm install
npm run dev
```

## 📝 Notlar
- API route: `/api/index.js`
- Ana sayfa: `index.html`
- Worker URL: Cloudflare Workers üzerinde çalışan analiz servisi

Telegram → Vercel → Cloudflare Worker akışı.

## Kurulum

### 1. Environment Variables
Vercel dashboard'da aşağıdaki environment variables'ları ekleyin:

- `BOT_TOKEN`: BotFather'dan aldığınız Telegram bot token'ı
- `WORKER_URL`: Cloudflare Worker URL'iniz (örn: https://one.1sec-one-system.workers.dev)

### 2. Vercel Deploy
```bash
# GitHub'a push edin
git add .
git commit -m "Telegram bot kurulumu"
git push origin main

# Vercel'de otomatik deploy olacak
```

### 3. Telegram Webhook Kurulumu
Vercel deploy sonrası webhook URL'inizi alın ve Telegram'a kaydedin:

```bash
# Webhook URL formatı
https://your-app-name.vercel.app/api

# Webhook kurulumu (BotFather ile)
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-app-name.vercel.app/api"}'
```

### 4. Test
Telegram'da botunuza şu komutları gönderin:
- `solusdt 1h`
- `btc 4h`
- `eth 1d`

## Sorun Giderme

### Bot Cevap Vermiyor
1. Vercel logs'ları kontrol edin
2. Environment variables doğru mu?
3. Worker URL çalışıyor mu?
4. Webhook doğru kurulmuş mu?

### Debug Endpoint
Worker'ınızda debug endpoint'i varsa:
```
https://your-worker.workers.dev/debug
```

## Dosya Yapısı
```
one-tg-bot/
├── api/
│   └── index.js          # Vercel serverless function
├── package.json          # Dependencies
├── vercel.json          # Vercel config
├── env.example          # Environment variables örneği
└── README.md            # Bu dosya
```