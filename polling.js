// Polling mode - Webhook çalışmadığında kullan
import fetch from 'node-fetch';

const BOT_TOKEN = '8471168944:AAGvghNuGdQ9L4jb9OYEPjIZJ6y--JTgko8';
const WORKER_URL = 'https://one.1sec-one-system.workers.dev';
const TG = (t) => `https://api.telegram.org/bot${t}`;

let lastUpdateId = 0;

async function getUpdates() {
  try {
    const response = await fetch(`${TG(BOT_TOKEN)}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    const data = await response.json();
    
    console.log(`🔍 Update kontrolü: ${data.result?.length || 0} mesaj`);
    
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        console.log(`📨 Yeni mesaj: ${update.message?.text} (Chat: ${update.message?.chat?.id})`);
        await handleMessage(update.message);
      }
    }
  } catch (error) {
    console.log('Update hatası:', error.message);
  }
}

async function handleMessage(msg) {
  if (!msg?.text) return;
  
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  
  console.log(`📨 Mesaj alındı: ${text} (Chat: ${chatId})`);
  
  // Komutları parse et
  const [raw, tf = "1h"] = text.split(/\s+/);
  const isFut = /p$/i.test(raw);
  const symbol = raw.replace(/p$/i, "").toUpperCase();
  
  if (symbol.length < 3) return; // Geçersiz sembol
  
  try {
    // Worker'dan analiz al
    const response = await fetch(`${WORKER_URL}/analyze?symbol=${symbol}&tf=${tf}&market=${isFut ? "futures" : "spot"}`);
    const data = await response.json();
    
    if (data.ok) {
      // Grafik ve analiz gönder
      const d = data.details;
      const tps = [d.tp1, d.tp2, d.tp3].filter(Boolean);
      const caption = `${data.summary}\n\nCornix Free Text:\n${cornix(d.symbol || symbol, d.side, d.entry, tps, d.sl)}`;
      
      await fetch(`${TG(BOT_TOKEN)}/sendPhoto`, {
        method: "POST",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: data.chartUrl,
          caption: caption
        })
      });
      
      console.log(`✅ Analiz gönderildi: ${symbol} ${tf}`);
    } else {
      await fetch(`${TG(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `❌ Veri alınamadı: ${symbol} ${tf}\nHata: ${data.error || 'Bilinmeyen hata'}`
        })
      });
    }
  } catch (error) {
    console.log(`❌ İşlem hatası: ${error.message}`);
    await fetch(`${TG(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ Sistem hatası: ${error.message}`
      })
    });
  }
}

function cornix(sym, side, entry, tps, sl) {
  const base = sym.toLowerCase().replace("usdt", "/usdt");
  return side === "SHORT"
    ? `${base}\nsell ${entry}\nbuy ${tps.join(", ")}\nstop ${sl}`
    : `${base}\nbuy ${entry}\nsell ${tps.join(", ")}\nstop ${sl}`;
}

// Polling döngüsü
console.log('🤖 Polling mode başlatıldı...');
setInterval(getUpdates, 1000); // Her saniye kontrol et
