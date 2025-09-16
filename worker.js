// worker.js — Analyze + Chart + Track + Cron + Telegram edit
// KV: env.SIGNALS  | Secret: env.TG_BOT
const BINANCE_SPOT = "https://api.binance.com";
const BINANCE_FUT  = "https://fapi.binance.com";

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/analyze") return analyzeHandler(u);
    if (u.pathname === "/track" && req.method === "POST") return trackHandler(req, env);
    if (u.pathname === "/health") return json({ok:true});
    return new Response("ok");
  },
  async scheduled(_event, env) {
    await pollOpenSignals(env);
  }
};

// ---------- /analyze ----------
async function analyzeHandler(u){
  // Timeout kontrolü - 20 saniye
  const startTime = Date.now();
  const TIMEOUT = 20000; // 20 saniye
  
  try{
    let symbol = (u.searchParams.get("symbol")||"BTCUSDT").toUpperCase();
    const tf     = u.searchParams.get("tf")||"1h";
    const market = (u.searchParams.get("market")||"spot").toLowerCase(); // "spot"|"futures"
    
    // P harfini kaldır (güvenlik kontrolü)
    if(symbol.endsWith("P")) {
      symbol = symbol.slice(0, -1);
      console.log(`🔧 P harfi kaldırıldı: ${symbol}`);
    }
    
    console.log(`🔍 Worker analizi: ${symbol} ${tf} (${market})`);
    console.log(`🔍 URL: ${u.href}`);
    
    // Futures işlemlerde de spot fiyat bilgisini al (daha stabil)
    // Daha fazla Binance endpoint'i dene
    const binanceUrls = [
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api2.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api3.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api4.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api-gcp.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`,
      `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`
    ];
    
    let r, k;
    for(let i = 0; i < binanceUrls.length; i++) {
      try {
        r = await fetch(binanceUrls[i], {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://tradingview.com',
          'Referer': 'https://tradingview.com',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
        if(r.ok) {
          k = await r.json();
          if(Array.isArray(k) && k.length > 0) break;
        }
      } catch(e) {
        console.log(`API hatası ${i+1}:`, e.message);
      }
    }
    
    if(!k || !Array.isArray(k) || k.length === 0) {
      throw new Error(`Binance API erişilemiyor - ${symbol} için veri bulunamadı. Lütfen daha sonra tekrar deneyin.`);
    }
    console.log('✅ Binance API başarılı - Gerçek veri alındı');
    const c = k.map(x=>+x[4]), h=k.map(x=>+x[2]), l=k.map(x=>+x[3]);
    const price = c.at(-1);

    // indikatörler
    const ema=(a,n)=>{const k=2/(n+1);let e=a[0];const o=[e];for(let i=1;i<a.length;i++){e=a[i]*k+e*(1-k);o.push(e)}return o};
    const rsi=(a,n=14)=>{let g=0,b=0;for(let i=1;i<=n;i++){const d=a[i]-a[i-1]; if(d>=0)g+=d; else b-=d}let G=g/n,B=b/n;const o=new Array(a.length).fill(50);for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1],up=d>0?d:0,dn=d<0?-d:0;G=(G*(n-1)+up)/n;B=(B*(n-1)+dn)/n;const rs=B===0?100:G/B;o[i]=100-100/(1+rs)}return o};
    const macd=(a,f=12,s=26,sg=9)=>{const ef=ema(a,f),es=ema(a,s);const m=a.map((_,i)=>ef[i]-es[i]);const si=ema(m,sg);const h=m.map((v,i)=>v-si[i]);return {m,si,h}};
    const atr=(H,L,C,n=14)=>{const tr=[];for(let i=0;i<C.length;i++){if(i===0)tr.push(H[i]-L[i]);else tr.push(Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1])))}return sma(tr,n)};
    const sma=(a,n)=>a.map((_,i)=>{if(i<n-1)return a[i];let s=0;for(let k=i-n+1;k<=i;k++)s+=a[k];return s/n});

  const e20=ema(c,20).at(-1), e50=ema(c,50).at(-1);
    const r14=rsi(c,14).at(-1);
    const {h:mh}=macd(c); const macdHist=mh.at(-1);
    const atr14=atr(h,l,c,14).at(-1);
  const hh20=Math.max(...h.slice(-20)), ll20=Math.min(...l.slice(-20));

    // Gelişmiş teknik analiz
    const sma20 = sma(c, 20).at(-1);
    const sma50 = sma(c, 50).at(-1);
    const sma200 = sma(c, 200).at(-1);
    const bb = bollingerBands(c, 20, 2);
    const stoch = stochastic(h, l, c, 14, 3);
    const williams = williamsR(h, l, c, 14);
    const adx = adxIndicator(h, l, c, 14);
    const obv = onBalanceVolume(c, k.map(x=>+x[5]));
    
    // Trend analizi
    const trend = analyzeTrend(c, e20, e50, sma20, sma50, sma200);
    
    // Momentum analizi
    const momentum = analyzeMomentum(r14, macdHist, stoch, williams);
    
    // Volatilite analizi
    const volatility = analyzeVolatility(atr14, bb, h, l);
    
    // Destek direnç analizi
    const supportResistance = findSupportResistance(h, l, c);
    
    // Haber analizi (ücretsiz)
    const newsAnalysis = await analyzeNews(symbol);
    
    // Genel skor hesaplama
    let score = 0;
    score += trend.score;
    score += momentum.score;
    score += volatility.score;
    score += supportResistance.score;
    score += newsAnalysis.score;
    
    // Akıllı yön belirleme - Her durumda karar ver!
    let side = "WAIT";
    let riskLevel = "LOW";
    
    if (score >= 3 && trend.direction === "UP" && momentum.bullish && volatility.favorable) {
      side = "LONG";
      riskLevel = "HIGH";
    } else if (score <= -3 && trend.direction === "DOWN" && momentum.bearish && volatility.favorable) {
      side = "SHORT";
      riskLevel = "HIGH";
    } else if (score >= 1) {
      side = "LONG";
      riskLevel = score >= 2 ? "MEDIUM" : "LOW";
    } else if (score <= -1) {
      side = "SHORT";
      riskLevel = score <= -2 ? "MEDIUM" : "LOW";
    } else {
      // Skor sıfıra yakınsa trend yönüne göre karar ver
      if (trend.direction === "UP") {
        side = "LONG";
        riskLevel = "LOW";
      } else if (trend.direction === "DOWN") {
        side = "SHORT";
        riskLevel = "LOW";
      } else {
        // Sideways trend - momentum'a göre karar ver
        if (momentum.bullish) {
          side = "LONG";
          riskLevel = "LOW";
        } else if (momentum.bearish) {
          side = "SHORT";
          riskLevel = "LOW";
        } else {
          // Son çare - fiyat pozisyonuna göre
          if (price > e20) {
            side = "LONG";
            riskLevel = "LOW";
          } else {
            side = "SHORT";
            riskLevel = "LOW";
          }
        }
      }
    }
    // Risk seviyesine göre akıllı seviyeler
    let entry=null, sl=null, tp1=null, tp2=null, tp3=null, entryScore=0, slScore=0;
    
    const conf = Math.max(0, Math.min(100, Math.round(Math.abs(score)/6*100)));

    if(side==="LONG"){ 
      const levels = calculateLongLevels(price, h, l, c, supportResistance, bb, atr14, trend, momentum, riskLevel, score, conf);
      entry = fix(levels.entry);
      sl = fix(levels.sl);
      tp1 = fix(levels.tp1);
      tp2 = fix(levels.tp2);
      tp3 = fix(levels.tp3);
      entryScore = levels.entryScore;
      slScore = levels.slScore;
    }
    else if(side==="SHORT"){ 
      const levels = calculateShortLevels(price, h, l, c, supportResistance, bb, atr14, trend, momentum, riskLevel, score, conf);
      entry = fix(levels.entry);
      sl = fix(levels.sl);
      tp1 = fix(levels.tp1);
      tp2 = fix(levels.tp2);
      tp3 = fix(levels.tp3);
      entryScore = levels.entryScore;
      slScore = levels.slScore;
    }

    // grafik url
    const chartUrl = buildChartUrl({ label:`${symbol} • ${tf} • ${side}`, data:c.slice(-120), entry, sl, tp1, tp2, tp3 });

    // Risk analizi al
    let riskAnalysis = { riskLevel: "UNKNOWN", riskScore: 0, riskReward: 0, volatility: "UNKNOWN", recommendation: "NO_DATA" };
    if (side === "LONG" || side === "SHORT") {
      riskAnalysis = calculateRiskAnalysis(entry, sl, tp1, tp2, tp3, atr14, price, riskLevel, Math.abs(score), conf, side);
    }
    
    // Çoklu dil desteği
    const lang = getLanguageFromSymbol(symbol);
    const summary = generateSummary(symbol, tf, market, price, r14, macdHist, e20, e50, atr14, score, conf, side, entry, sl, tp1, tp2, tp3, newsAnalysis, riskLevel, riskAnalysis, lang);

    // Timeout kontrolü
    const elapsed = Date.now() - startTime;
    if (elapsed > TIMEOUT) {
      console.log(`⏰ Timeout: ${elapsed}ms > ${TIMEOUT}ms`);
      return json({ok:false,error:"Worker timeout - İşlem çok uzun sürdü"},500);
    }
    
    return json({
      ok:true,
      summary,
      details:{ symbol, tf, market, price, r:r14, macdHist, e20, e50, atr:atr14, side, entry, sl, tp1, tp2, tp3, score, confidence:conf, newsAnalysis, entryScore, slScore, riskAnalysis },
      chartUrl
    });
  }catch(e){ 
    const elapsed = Date.now() - startTime;
    console.log(`❌ Worker hatası (${elapsed}ms): ${e.message}`);
    return json({ok:false,error:String(e)},500); 
  }
}

// ---------- /track ----------
async function trackHandler(req, env){
  try{
    const s = await req.json(); // {id, chat_id, message_id, symbol, market, side, entry,tp1,tp2,tp3, sl}
    s.status = "OPEN"; s.createdAt = Date.now();
    await env.SIGNALS.put(`sig:${s.id}`, JSON.stringify(s));
    return json({ok:true});
  }catch(e){ return json({ok:false,error:String(e)},500); }
}

// ---------- Cron kontrol + edit ----------
async function pollOpenSignals(env){
  const list = await env.SIGNALS.list({prefix:"sig:"});
  for(const it of list.keys){
    const raw = await env.SIGNALS.get(it.name); if(!raw) continue;
    const s = JSON.parse(raw); if(s.status!=="OPEN") continue;

    const p = await lastPrice(s.symbol, s.market);
    const hit = decideHit(s.side, p, s); // "TP1"|"TP2"|"TP3"|"SL"|null
    if(!hit) continue;

    // Mesajı güncelle
    const newText = applyMark(s.cachedText || baseTextFromSignal(s), hit, s);
    await editMessage(env.TG_BOT, s.chat_id, s.message_id, newText);

    s.status = hit; s.closedAt = Date.now(); s.cachedText = newText;
    await env.SIGNALS.put(it.name, JSON.stringify(s));
  }
}

function baseTextFromSignal(s){
  return `Coin: ${s.symbol}  TF: ${s.tf} (${s.market.toUpperCase()})
Plan: ${s.side}
Giriş: ${fx(s.entry)}  SL: ${fx(s.sl)}
TP1: ${fx(s.tp1)}  TP2: ${fx(s.tp2)}  TP3: ${fx(s.tp3)}
Durum: ⏳ Açık`;
}

function applyMark(text, hit, s){
  const mark = hit==="SL"?"❌":"✅";
  let t = text.replace("Durum: ⏳ Açık", `Durum: ${hit==="SL"?"❌ Stop Loss":`${mark} ${hit}`}`);
  if(hit.startsWith("TP")){
    t = t.replace(`${hit}: ${fx(s[hit.toLowerCase()])}`, `${hit}: ${fx(s[hit.toLowerCase()])} ${mark}`);
  }
  return t;
}

async function lastPrice(symbol, market){
  // Futures işlemlerde de spot fiyat bilgisini al (daha stabil)
  // Daha fazla Binance endpoint'i dene
  const binanceUrls = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api1.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api2.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api3.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api4.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api-gcp.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api.binance.us/api/v3/ticker/price?symbol=${symbol}`
  ];
  
  for(let i = 0; i < binanceUrls.length; i++) {
    try {
      const r = await fetch(binanceUrls[i], {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://tradingview.com',
          'Referer': 'https://tradingview.com'
        }
      });
      if(r.ok) {
        const j = await r.json();
        return +j.price;
      }
    } catch(e) {
      console.log(`Price API hatası ${i+1}:`, e.message);
    }
  }
  
  throw new Error('Binance price API erişilemiyor - Gerçek fiyat gerekli');
}

function decideHit(side, p, s){
  if(side==="LONG"){
    if(p<=s.sl) return "SL";
    if(s.tp3 && p>=s.tp3) return "TP3";
    if(s.tp2 && p>=s.tp2) return "TP2";
    if(s.tp1 && p>=s.tp1) return "TP1";
  }else if(side==="SHORT"){
    if(p>=s.sl) return "SL";
    if(s.tp3 && p<=s.tp3) return "TP3";
    if(s.tp2 && p<=s.tp2) return "TP2";
    if(s.tp1 && p<=s.tp1) return "TP1";
  }
  return null;
}

async function editMessage(TOKEN, chatId, messageId, text){
  await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageText`,{
    method:"POST", headers:{'content-type':'application/json'},
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode:"Markdown" })
  });
}


// ---------- Gelişmiş Teknik Analiz Fonksiyonları ----------

function sma(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return prices[i];
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += prices[k];
    return sum / period;
  });
}

function bollingerBands(prices, period, stdDev) {
  const smaValues = sma(prices, period);
  const std = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = smaValues[i];
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
    std.push(Math.sqrt(variance));
  }
  const upper = smaValues.map((val, i) => val + (std[i] * stdDev));
  const lower = smaValues.map((val, i) => val - (std[i] * stdDev));
  return { upper: upper.at(-1), middle: smaValues.at(-1), lower: lower.at(-1) };
}

function stochastic(high, low, close, kPeriod, dPeriod) {
  const kValues = [];
  for (let i = kPeriod - 1; i < close.length; i++) {
    const hh = Math.max(...high.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...low.slice(i - kPeriod + 1, i + 1));
    const k = ((close[i] - ll) / (hh - ll)) * 100;
    kValues.push(k);
  }
  const dValues = sma(kValues, dPeriod);
  return { k: kValues.at(-1), d: dValues.at(-1) };
}

function williamsR(high, low, close, period) {
  const wr = [];
  for (let i = period - 1; i < close.length; i++) {
    const hh = Math.max(...high.slice(i - period + 1, i + 1));
    const ll = Math.min(...low.slice(i - period + 1, i + 1));
    const wr_val = ((hh - close[i]) / (hh - ll)) * -100;
    wr.push(wr_val);
  }
  return wr.at(-1);
}

function adxIndicator(high, low, close, period) {
  const tr = [];
  for (let i = 1; i < close.length; i++) {
    tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i-1]), Math.abs(low[i] - close[i-1])));
  }
  const atr = sma(tr, period);
  const plusDM = [];
  const minusDM = [];
  for (let i = 1; i < high.length; i++) {
    const hDiff = high[i] - high[i-1];
    const lDiff = low[i-1] - low[i];
    plusDM.push(hDiff > lDiff && hDiff > 0 ? hDiff : 0);
    minusDM.push(lDiff > hDiff && lDiff > 0 ? lDiff : 0);
  }
  const plusDI = plusDM.map((val, i) => (val / atr[i]) * 100);
  const minusDI = minusDM.map((val, i) => (val / atr[i]) * 100);
  const dx = plusDI.map((val, i) => Math.abs(val - minusDI[i]) / (val + minusDI[i]) * 100);
  const adx = sma(dx, period);
  return { adx: adx.at(-1), plusDI: plusDI.at(-1), minusDI: minusDI.at(-1) };
}

function onBalanceVolume(close, volume) {
  let obv = 0;
  const obvValues = [obv];
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i-1]) obv += volume[i];
    else if (close[i] < close[i-1]) obv -= volume[i];
    obvValues.push(obv);
  }
  return obvValues.at(-1);
}

function analyzeTrend(prices, ema20, ema50, sma20, sma50, sma200) {
  let score = 0;
  let direction = "SIDEWAYS";
  
  // EMA trend
  if (ema20 > ema50) score += 1;
  else if (ema20 < ema50) score -= 1;
  
  // SMA trend
  if (sma20 > sma50) score += 1;
  else if (sma20 < sma50) score -= 1;
  
  // Long term trend
  if (prices.at(-1) > sma200) score += 1;
  else if (prices.at(-1) < sma200) score -= 1;
  
  // Price vs EMAs
  if (prices.at(-1) > ema20 && prices.at(-1) > ema50) score += 1;
  else if (prices.at(-1) < ema20 && prices.at(-1) < ema50) score -= 1;
  
  if (score >= 2) direction = "UP";
  else if (score <= -2) direction = "DOWN";
  
  return { score, direction };
}

function analyzeMomentum(rsi, macdHist, stoch, williams) {
  let score = 0;
  let bullish = false;
  let bearish = false;
  
  // RSI
  if (rsi > 50 && rsi < 70) score += 1;
  else if (rsi < 50 && rsi > 30) score -= 1;
  else if (rsi > 70) score -= 0.5; // Overbought
  else if (rsi < 30) score += 0.5; // Oversold
  
  // MACD
  if (macdHist > 0) score += 1;
  else score -= 1;
  
  // Stochastic
  if (stoch.k > 50 && stoch.k < 80) score += 1;
  else if (stoch.k < 50 && stoch.k > 20) score -= 1;
  
  // Williams %R
  if (williams > -50 && williams < -20) score += 1;
  else if (williams < -50 && williams > -80) score -= 1;
  
  if (score >= 2) bullish = true;
  else if (score <= -2) bearish = true;
  
  return { score, bullish, bearish };
}

function analyzeVolatility(atr, bb, high, low) {
  let score = 0;
  let favorable = false;
  
  // ATR analizi - yeterli volatilite var mı?
  const price = (high.at(-1) + low.at(-1)) / 2;
  const atrPercent = (atr / price) * 100;
  
  if (atrPercent > 1 && atrPercent < 5) score += 1; // İdeal volatilite
  else if (atrPercent < 0.5) score -= 1; // Çok düşük volatilite
  else if (atrPercent > 10) score -= 1; // Çok yüksek volatilite
  
  // Bollinger Bands pozisyonu
  const currentPrice = high.at(-1);
  if (currentPrice > bb.middle) score += 0.5;
  else score -= 0.5;
  
  // Band genişliği
  const bandWidth = ((bb.upper - bb.lower) / bb.middle) * 100;
  if (bandWidth > 2 && bandWidth < 8) score += 1; // İdeal band genişliği
  
  if (score >= 1) favorable = true;
  
  return { score, favorable, atrPercent, bandWidth };
}

function findSupportResistance(high, low, close) {
  const prices = [...close];
  const lookback = 20;
  const currentPrice = close.at(-1);
  
  // Son 20 mumda en yüksek ve en düşük noktaları bul
  const recentHigh = Math.max(...high.slice(-lookback));
  const recentLow = Math.min(...low.slice(-lookback));
  
  let score = 0;
  
  // Destek seviyesi analizi
  const supportLevels = [];
  for (let i = 0; i < close.length - 5; i++) {
    const slice = low.slice(i, i + 5);
    const min = Math.min(...slice);
    if (slice.filter(x => x === min).length >= 2) {
      supportLevels.push(min);
    }
  }
  
  // Direnç seviyesi analizi
  const resistanceLevels = [];
  for (let i = 0; i < close.length - 5; i++) {
    const slice = high.slice(i, i + 5);
    const max = Math.max(...slice);
    if (slice.filter(x => x === max).length >= 2) {
      resistanceLevels.push(max);
    }
  }
  
  // Mevcut fiyatın destek/direnç seviyelerine yakınlığı
  const nearSupport = supportLevels.some(level => Math.abs(currentPrice - level) / currentPrice < 0.02);
  const nearResistance = resistanceLevels.some(level => Math.abs(currentPrice - level) / currentPrice < 0.02);
  
  if (nearSupport) score += 1;
  if (nearResistance) score -= 1;
  
  return { 
    score, 
    supportLevels: supportLevels.slice(-3), 
    resistanceLevels: resistanceLevels.slice(-3),
    nearSupport,
    nearResistance
  };
}

function calculateLongLevels(price, high, low, close, supportResistance, bb, atr, trend, momentum, riskLevel = "MEDIUM", score = 0, conf = 0) {
  // Fibonacci retracement seviyeleri hesapla
  const fibLevels = calculateFibonacciLevels(high, low);
  
  // En iyi giriş noktası bulma
  let entry = price;
  let entryScore = 0;
  let bestEntry = price;
  
  // 1. Fibonacci 0.618 seviyesi (en güçlü destek)
  if (fibLevels.level618 && fibLevels.level618 < price) {
    const score = calculateEntryScore(fibLevels.level618, price, atr, supportResistance, 'fibonacci');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = fibLevels.level618 + (atr * 0.05);
    }
  }
  
  // 2. Fibonacci 0.5 seviyesi
  if (fibLevels.level500 && fibLevels.level500 < price) {
    const score = calculateEntryScore(fibLevels.level500, price, atr, supportResistance, 'fibonacci');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = fibLevels.level500 + (atr * 0.05);
    }
  }
  
  // 3. Destek seviyeleri
  if (supportResistance.supportLevels.length > 0) {
    const nearestSupport = supportResistance.supportLevels.reduce((prev, curr) => 
      Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
    );
    if (nearestSupport < price) {
      const score = calculateEntryScore(nearestSupport, price, atr, supportResistance, 'support');
      if (score > entryScore) {
        entryScore = score;
        bestEntry = nearestSupport + (atr * 0.1);
      }
    }
  }
  
  // 4. Bollinger alt bandı
  if (bb.lower && bb.lower < price) {
    const score = calculateEntryScore(bb.lower, price, atr, supportResistance, 'bollinger');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = bb.lower + (atr * 0.1);
    }
  }
  
  entry = bestEntry;
  
  // Risk seviyesine göre ATR çarpanları
  const atrMultipliers = {
    "LOW": { sl: 1.5, tp1: 1.0, tp2: 1.5, tp3: 2.0 },
    "MEDIUM": { sl: 2.0, tp1: 1.5, tp2: 2.5, tp3: 3.5 },
    "HIGH": { sl: 2.5, tp1: 2.0, tp2: 3.0, tp3: 4.0 }
  };
  
  const multipliers = atrMultipliers[riskLevel] || atrMultipliers["MEDIUM"];
  
  // En iyi Stop Loss hesaplama
  let sl = entry - (atr * multipliers.sl);
  let slScore = 0;
  let bestSl = sl;
  
  // 1. Fibonacci 0.236 seviyesi
  if (fibLevels.level236 && fibLevels.level236 < entry) {
    const score = calculateSlScore(fibLevels.level236, entry, atr, 'fibonacci');
    if (score > slScore) {
      slScore = score;
      bestSl = fibLevels.level236 - (atr * 0.1);
    }
  }
  
  // 2. En düşük destek seviyesi
  if (supportResistance.supportLevels.length > 0) {
    const lowestSupport = Math.min(...supportResistance.supportLevels);
    if (lowestSupport < entry) {
      const score = calculateSlScore(lowestSupport, entry, atr, 'support');
      if (score > slScore) {
        slScore = score;
        bestSl = lowestSupport - (atr * 0.2);
      }
    }
  }
  
  sl = bestSl;
  
  // Risk seviyesine göre Take Profit seviyeleri
  const risk = entry - sl;
  let tp1, tp2, tp3;
  
  // TP1 - Risk seviyesine göre
  const tp1Multiplier = multipliers.tp1;
  tp1 = entry + (risk * tp1Multiplier);
  
  // TP2 - Risk seviyesine göre
  const tp2Multiplier = multipliers.tp2;
  tp2 = entry + (risk * tp2Multiplier);
  
  // TP3 - Risk seviyesine göre
  const tp3Multiplier = multipliers.tp3;
  tp3 = entry + (risk * tp3Multiplier);
  
  return { entry, sl, tp1, tp2, tp3, entryScore, slScore };
}

function calculateRiskAnalysis(entry, sl, tp1, tp2, tp3, atr, price, riskLevel, absScore, conf, side = "LONG") {
  if (!entry || !sl) {
    return {
      riskLevel: "UNKNOWN",
      riskScore: 0,
      riskReward: 0,
      volatility: "UNKNOWN",
      recommendation: "NO_DATA"
    };
  }
  
  // Risk/Reward oranı hesaplama
  const risk = Math.abs(entry - sl);
  const reward1 = Math.abs(tp1 - entry);
  const reward2 = Math.abs(tp2 - entry);
  const reward3 = Math.abs(tp3 - entry);
  
  const riskReward1 = reward1 / risk;
  const riskReward2 = reward2 / risk;
  const riskReward3 = reward3 / risk;
  const avgRiskReward = (riskReward1 + riskReward2 + riskReward3) / 3;
  
  // Volatilite analizi
  const atrPercent = (atr / price) * 100;
  let volatility = "LOW";
  if (atrPercent > 3) volatility = "HIGH";
  else if (atrPercent > 1.5) volatility = "MEDIUM";
  
  // Risk skoru hesaplama (0-100)
  let riskScore = 0;
  
  // Risk/Reward skoru (40 puan)
  if (avgRiskReward >= 2) riskScore += 40;
  else if (avgRiskReward >= 1.5) riskScore += 30;
  else if (avgRiskReward >= 1) riskScore += 20;
  else if (avgRiskReward >= 0.5) riskScore += 10;
  
  // Volatilite skoru (20 puan)
  if (volatility === "MEDIUM") riskScore += 20;
  else if (volatility === "HIGH") riskScore += 10;
  else riskScore += 15;
  
  // Güven skoru (20 puan)
  riskScore += Math.round(conf / 5);
  
  // Genel skor (20 puan)
  if (absScore >= 3) riskScore += 20;
  else if (absScore >= 2) riskScore += 15;
  else if (absScore >= 1) riskScore += 10;
  else riskScore += 5;
  
  // Risk seviyesi belirleme
  let finalRiskLevel = "LOW";
  if (riskScore >= 80) finalRiskLevel = "VERY_LOW";
  else if (riskScore >= 60) finalRiskLevel = "LOW";
  else if (riskScore >= 40) finalRiskLevel = "MEDIUM";
  else if (riskScore >= 20) finalRiskLevel = "HIGH";
  else finalRiskLevel = "VERY_HIGH";
  
  // Öneri belirleme - Side'a göre ayarla
  let recommendation = "HOLD";
  if (side === "LONG") {
    if (riskScore >= 70) recommendation = "STRONG_BUY";
    else if (riskScore >= 50) recommendation = "BUY";
    else if (riskScore >= 30) recommendation = "WEAK_BUY";
    else recommendation = "HOLD";
  } else if (side === "SHORT") {
    if (riskScore >= 70) recommendation = "STRONG_SELL";
    else if (riskScore >= 50) recommendation = "SELL";
    else if (riskScore >= 30) recommendation = "WEAK_SELL";
    else recommendation = "HOLD";
  } else {
    if (riskScore >= 70) recommendation = "STRONG_BUY";
    else if (riskScore >= 50) recommendation = "BUY";
    else if (riskScore >= 30) recommendation = "HOLD";
    else if (riskScore >= 15) recommendation = "SELL";
    else recommendation = "STRONG_SELL";
  }
  
  return {
    riskLevel: finalRiskLevel,
    riskScore: Math.round(riskScore),
    riskReward: Math.round(avgRiskReward * 100) / 100,
    volatility: volatility,
    recommendation: recommendation,
    details: {
      riskAmount: risk,
      reward1: reward1,
      reward2: reward2,
      reward3: reward3,
      riskReward1: Math.round(riskReward1 * 100) / 100,
      riskReward2: Math.round(riskReward2 * 100) / 100,
      riskReward3: Math.round(riskReward3 * 100) / 100,
      atrPercent: Math.round(atrPercent * 100) / 100
    }
  };
}

function calculateFibonacciLevels(high, low) {
  const recentHigh = Math.max(...high.slice(-20));
  const recentLow = Math.min(...low.slice(-20));
  const diff = recentHigh - recentLow;
  
  return {
    level0: recentHigh,
    level236: recentHigh - (diff * 0.236),
    level382: recentHigh - (diff * 0.382),
    level500: recentHigh - (diff * 0.500),
    level618: recentHigh - (diff * 0.618),
    level100: recentLow
  };
}

function calculateEntryScore(level, currentPrice, atr, supportResistance, type) {
  let score = 0;
  
  // Fiyata yakınlık (ne kadar yakınsa o kadar iyi)
  const distance = Math.abs(level - currentPrice);
  const atrPercent = (distance / currentPrice) * 100;
  if (atrPercent < 1) score += 3;
  else if (atrPercent < 2) score += 2;
  else if (atrPercent < 3) score += 1;
  
  // Tip bazlı skor
  switch(type) {
    case 'fibonacci':
      score += 4; // Fibonacci en güçlü
      break;
    case 'support':
      score += 3;
      break;
    case 'bollinger':
      score += 2;
      break;
    default:
      score += 1;
  }
  
  // Destek seviyesi gücü
  if (supportResistance.supportLevels.includes(level)) {
    score += 2;
  }
  
  return score;
}

function calculateSlScore(level, entry, atr, type) {
  let score = 0;
  
  // Entry'den uzaklık (ne kadar uzaksa o kadar iyi)
  const distance = Math.abs(entry - level);
  const atrPercent = (distance / entry) * 100;
  if (atrPercent > 2) score += 3;
  else if (atrPercent > 1) score += 2;
  else if (atrPercent > 0.5) score += 1;
  
  // Tip bazlı skor
  switch(type) {
    case 'fibonacci':
      score += 4;
      break;
    case 'support':
      score += 3;
      break;
    default:
      score += 1;
  }
  
  return score;
}

function calculateShortLevels(price, high, low, close, supportResistance, bb, atr, trend, momentum, riskLevel = "MEDIUM", score = 0, conf = 0) {
  // Fibonacci retracement seviyeleri hesapla
  const fibLevels = calculateFibonacciLevels(high, low);
  
  // En iyi giriş noktası bulma
  let entry = price;
  let entryScore = 0;
  let bestEntry = price;
  
  // 1. Fibonacci 0.382 seviyesi (en güçlü direnç)
  if (fibLevels.level382 && fibLevels.level382 > price) {
    const score = calculateEntryScore(fibLevels.level382, price, atr, supportResistance, 'fibonacci');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = fibLevels.level382 - (atr * 0.05);
    }
  }
  
  // 2. Fibonacci 0.5 seviyesi
  if (fibLevels.level500 && fibLevels.level500 > price) {
    const score = calculateEntryScore(fibLevels.level500, price, atr, supportResistance, 'fibonacci');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = fibLevels.level500 - (atr * 0.05);
    }
  }
  
  // 3. Direnç seviyeleri
  if (supportResistance.resistanceLevels.length > 0) {
    const nearestResistance = supportResistance.resistanceLevels.reduce((prev, curr) => 
      Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
    );
    if (nearestResistance > price) {
      const score = calculateEntryScore(nearestResistance, price, atr, supportResistance, 'resistance');
      if (score > entryScore) {
        entryScore = score;
        bestEntry = nearestResistance - (atr * 0.1);
      }
    }
  }
  
  // 4. Bollinger üst bandı
  if (bb.upper && bb.upper > price) {
    const score = calculateEntryScore(bb.upper, price, atr, supportResistance, 'bollinger');
    if (score > entryScore) {
      entryScore = score;
      bestEntry = bb.upper - (atr * 0.1);
    }
  }
  
  entry = bestEntry;
  
  // Risk seviyesine göre ATR çarpanları
  const atrMultipliers = {
    "LOW": { sl: 1.5, tp1: 1.0, tp2: 1.5, tp3: 2.0 },
    "MEDIUM": { sl: 2.0, tp1: 1.5, tp2: 2.5, tp3: 3.5 },
    "HIGH": { sl: 2.5, tp1: 2.0, tp2: 3.0, tp3: 4.0 }
  };
  
  const multipliers = atrMultipliers[riskLevel] || atrMultipliers["MEDIUM"];
  
  // En iyi Stop Loss hesaplama
  let sl = entry + (atr * multipliers.sl);
  let slScore = 0;
  let bestSl = sl;
  
  // 1. Fibonacci 0.236 seviyesi
  if (fibLevels.level236 && fibLevels.level236 > entry) {
    const score = calculateSlScore(fibLevels.level236, entry, atr, 'fibonacci');
    if (score > slScore) {
      slScore = score;
      bestSl = fibLevels.level236 + (atr * 0.1);
    }
  }
  
  // 2. En yüksek direnç seviyesi
  if (supportResistance.resistanceLevels.length > 0) {
    const highestResistance = Math.max(...supportResistance.resistanceLevels);
    if (highestResistance > entry) {
      const score = calculateSlScore(highestResistance, entry, atr, 'resistance');
      if (score > slScore) {
        slScore = score;
        bestSl = highestResistance + (atr * 0.2);
      }
    }
  }
  
  sl = bestSl;
  
  // Risk seviyesine göre Take Profit seviyeleri
  const risk = sl - entry;
  let tp1, tp2, tp3;
  
  // TP1 - Risk seviyesine göre
  const tp1Multiplier = multipliers.tp1;
  tp1 = entry - (risk * tp1Multiplier);
  
  // TP2 - Risk seviyesine göre
  const tp2Multiplier = multipliers.tp2;
  tp2 = entry - (risk * tp2Multiplier);
  
  // TP3 - Risk seviyesine göre
  const tp3Multiplier = multipliers.tp3;
  tp3 = entry - (risk * tp3Multiplier);
  
  return { entry, sl, tp1, tp2, tp3, entryScore, slScore };
}

// ---------- Ücretsiz Haber Analizi ----------

async function analyzeNews(symbol) {
  try {
    // CoinGecko API - Ücretsiz
    const coinId = getCoinId(symbol);
    if (!coinId) return { score: 0, sentiment: "NEUTRAL", news: [] };
    
    // 1. CoinGecko trending coins
    const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
    const trendingData = await trendingResponse.json();
    const isTrending = trendingData.coins.some(coin => 
      coin.item.symbol.toLowerCase() === symbol.replace('USDT', '').toLowerCase()
    );
    
    // 2. Reddit API - Ücretsiz
    const redditResponse = await fetch(`https://www.reddit.com/r/cryptocurrency/search.json?q=${symbol}&sort=hot&limit=10`);
    const redditData = await redditResponse.json();
    const redditPosts = redditData.data?.children || [];
    
    // 3. CryptoPanic API - Ücretsiz
    const newsResponse = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=free&currencies=${coinId}&public=true`);
    const newsData = await newsResponse.json();
    const news = newsData.results || [];
    
    // Sentiment analizi
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    
    // Reddit sentiment
    redditPosts.forEach(post => {
      const title = post.data.title.toLowerCase();
      const score = post.data.score;
      
      if (title.includes('moon') || title.includes('bull') || title.includes('pump') || title.includes('buy')) {
        positiveCount += Math.min(score, 10);
      } else if (title.includes('dump') || title.includes('bear') || title.includes('crash') || title.includes('sell')) {
        negativeCount += Math.min(score, 10);
      } else {
        neutralCount += 1;
      }
    });
    
    // News sentiment
    news.forEach(article => {
      const title = article.title.toLowerCase();
      const kind = article.kind;
      
      if (kind === 'positive' || title.includes('bullish') || title.includes('rise') || title.includes('gain')) {
        positiveCount += 2;
      } else if (kind === 'negative' || title.includes('bearish') || title.includes('fall') || title.includes('drop')) {
        negativeCount += 2;
      } else {
        neutralCount += 1;
      }
    });
    
    // Skor hesaplama
    let score = 0;
    let sentiment = "NEUTRAL";
    
    const total = positiveCount + negativeCount + neutralCount;
    if (total > 0) {
      const positiveRatio = positiveCount / total;
      const negativeRatio = negativeCount / total;
      
      if (positiveRatio > 0.6) {
        score = 2;
        sentiment = "POSITIVE";
      } else if (negativeRatio > 0.6) {
        score = -2;
        sentiment = "NEGATIVE";
      } else {
        score = 0;
        sentiment = "NEUTRAL";
      }
    }
    
    // Trending bonus
    if (isTrending) {
      score += 1;
    }
    
    return {
      score,
      sentiment,
      news: news.slice(0, 3).map(article => ({
        title: article.title,
        url: article.url,
        kind: article.kind
      })),
      redditPosts: redditPosts.slice(0, 3).map(post => ({
        title: post.data.title,
        url: `https://reddit.com${post.data.permalink}`,
        score: post.data.score
      })),
      isTrending
    };
    
  } catch (error) {
    console.log('Haber analizi hatası:', error.message);
    return { score: 0, sentiment: "NEUTRAL", news: [] };
  }
}

function getCoinId(symbol) {
  const coinMap = {
    'BTCUSDT': 'bitcoin',
    'ETHUSDT': 'ethereum',
    'ADAUSDT': 'cardano',
    'DOGEUSDT': 'dogecoin',
    'SOLUSDT': 'solana',
    'MATICUSDT': 'matic-network',
    'DOTUSDT': 'polkadot',
    'LINKUSDT': 'chainlink',
    'UNIUSDT': 'uniswap',
    'AVAXUSDT': 'avalanche-2'
  };
  
  return coinMap[symbol] || null;
}

// ---------- Çoklu Dil Desteği ----------

function getLanguageFromSymbol(symbol) {
  // Sembol bazlı dil seçimi
  const langMap = {
    'BTCUSDT': 'en', // Bitcoin - İngilizce
    'ETHUSDT': 'en', // Ethereum - İngilizce
    'DOGEUSDT': 'en', // Dogecoin - İngilizce
    'ADAUSDT': 'en', // Cardano - İngilizce
    'SOLUSDT': 'en', // Solana - İngilizce
    'MATICUSDT': 'en', // Polygon - İngilizce
    'DOTUSDT': 'en', // Polkadot - İngilizce
    'LINKUSDT': 'en', // Chainlink - İngilizce
    'UNIUSDT': 'en', // Uniswap - İngilizce
    'AVAXUSDT': 'en'  // Avalanche - İngilizce
  };
  
  return langMap[symbol] || 'en';
}

function generateSummary(symbol, tf, market, price, r14, macdHist, e20, e50, atr14, score, conf, side, entry, sl, tp1, tp2, tp3, newsAnalysis, riskLevel, riskAnalysis, lang) {
  const translations = {
    en: {
      coin: 'Coin',
      price: 'Price',
      plan: 'Plan',
      entry: 'Entry',
      news: 'News',
      status: 'Status',
      open: 'Open',
      wait: 'WAIT',
      long: 'LONG',
      short: 'SHORT',
      positive: 'POSITIVE',
      negative: 'NEGATIVE',
      neutral: 'NEUTRAL'
    },
    tr: {
      coin: 'Coin',
      price: 'Fiyat',
      plan: 'Plan',
      entry: 'Giriş',
      news: 'Haber',
      status: 'Durum',
      open: 'Açık',
      wait: 'BEKLE',
      long: 'LONG',
      short: 'SHORT',
      positive: 'POZİTİF',
      negative: 'NEGATİF',
      neutral: 'NÖTR'
    },
    ar: {
      coin: 'العملة',
      price: 'السعر',
      plan: 'الخطة',
      entry: 'الدخول',
      news: 'الأخبار',
      status: 'الحالة',
      open: 'مفتوح',
      wait: 'انتظار',
      long: 'شراء',
      short: 'بيع',
      positive: 'إيجابي',
      negative: 'سلبي',
      neutral: 'محايد'
    },
    ru: {
      coin: 'Монета',
      price: 'Цена',
      plan: 'План',
      entry: 'Вход',
      news: 'Новости',
      status: 'Статус',
      open: 'Открыт',
      wait: 'ЖДАТЬ',
      long: 'ПОКУПКА',
      short: 'ПРОДАЖА',
      positive: 'ПОЗИТИВ',
      negative: 'НЕГАТИВ',
      neutral: 'НЕЙТРАЛ'
    }
  };
  
  const t = translations[lang] || translations.en;
  
  return `${t.coin}: ${symbol}  TF: ${tf} (${market.toUpperCase()})
${t.price}: ${fx(price)}  RSI14: ${fx(r14)}  MACD-h: ${fx(macdHist,4)}
EMA20: ${fx(e20)}  EMA50: ${fx(e50)}  ATR: ${fx(atr14)}
Skor: ${score}  Güven: ${conf}%  Risk: ${riskLevel}
${t.plan}: ${side}
${t.entry}: ${fx(entry)}  SL: ${fx(sl)}
TP1: ${fx(tp1)}  TP2: ${fx(tp2)}  TP3: ${fx(tp3)}
${t.news}: ${newsAnalysis.sentiment} ${newsAnalysis.isTrending ? "🔥" : ""}
Risk Analizi: ${riskAnalysis.riskLevel} (${riskAnalysis.riskScore}/100)
Risk/Reward: ${riskAnalysis.riskReward}  Volatilite: ${riskAnalysis.volatility}
Öneri: ${riskAnalysis.recommendation}
${t.status}: ⏳ ${t.open}`;
}

// ---------- helpers ----------
function buildChartUrl({label, data, entry, sl, tp1, tp2, tp3}){
  const cfg = {
    type:"line",
    data:{ labels:data.map((_,i)=>`${i}`), datasets:[{ data, borderWidth:2, pointRadius:0, tension:0.2 }]},
    options:{
      plugins:{
        legend:{display:false}, title:{display:true, text:label},
        annotation:{ annotations:{
          entry:{type:"line",yMin:entry,yMax:entry,borderColor:"#3b82f6",borderWidth:2,label:{display:true,content:`ENTRY ${entry}`}},
          sl:{type:"line",yMin:sl,yMax:sl,borderColor:"#ef4444",borderWidth:2,label:{display:true,content:`SL ${sl}`}},
          tp1:{type:"line",yMin:tp1,yMax:tp1,borderColor:"#22c55e",borderDash:[6,6],label:{display:true,content:`TP1 ${tp1}`}},
          tp2:{type:"line",yMin:tp2,yMax:tp2,borderColor:"#16a34a",borderDash:[6,6],label:{display:true,content:`TP2 ${tp2}`}},
          tp3:{type:"line",yMin:tp3,yMax:tp3,borderColor:"#15803d",borderDash:[6,6],label:{display:true,content:`TP3 ${tp3}`}}
        }}
      }
    }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&w=1000&h=520&bkg=white`;
}
const fx=(v,p)=>v==null?"-":(p!=null? (+v).toFixed(p) : (Math.abs(+v)>=1? (+v).toFixed(3): (+v).toFixed(4)));
const fix=(v)=>v==null?null:(Math.abs(+v)>=1? (+v).toFixed(3): (+v).toFixed(4));
function json(o,s=200){ return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}}); }