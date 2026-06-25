// Liquidity Radar API — Vercel Serverless Function
// OKX proxy + OpenAI + Gmail SMTP (App Password)

import nodemailer from 'nodemailer';

// OKX proxy endpoints
const OKX_BASE = "https://www.okx.com/api/v5/market";
const SYMBOL_TO_OKX = {
  BTC: "BTC-USDT", ETH: "ETH-USDT", SOL: "SOL-USDT",
  XRP: "XRP-USDT", BNB: "BNB-USDT", DOGE: "DOGE-USDT"
};
const INTERVAL_TO_OKX = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "12h": "12H",
  "1d": "1D", "1w": "1W"
};

const MAIL_FROM = 'appsuppor2026@gmail.com';
const MAIL_ADMIN = 'appsuppor2026@gmail.com';

// Lazy SMTP transporter
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: MAIL_FROM,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

async function sendEmail({ to, subject, text, html }) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Liquidity Radar Crypto" <${MAIL_FROM}>`,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('SMTP error:', err.message);
    return { ok: false, error: err.message };
  }
}

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function jsonResponse(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  try {
    // ── Health ──
    if (path === "/api/healthz" || path === "/healthz") {
      return jsonResponse(res, 200, { status: "ok", time: new Date().toISOString() });
    }

    // ── API Info ──
    if (path === "/api" || path === "/api/" || path === "/") {
      return jsonResponse(res, 200, {
        message: "Liquidity Radar API",
        version: "1.0.0",
        routes: ["/api/healthz", "/api/market/ticker", "/api/market/klines", "/api/ai/analyze", "/api/ai/contact", "/api/ai/alert-email", "/api/ai/onboarding", "/api/ai/profile-notify", "/api/stripe/plans", "/api/push/vapid-key"]
      });
    }

    // ── Market Ticker ──
    if (path === "/api/market/ticker") {
      const symbol = url.searchParams.get("symbol") || "BTC";
      const sym = symbol.toUpperCase();
      const instId = SYMBOL_TO_OKX[sym];
      if (!instId) return jsonResponse(res, 400, { error: "Unknown symbol" });

      const upstream = await fetch(`${OKX_BASE}/ticker?instId=${instId}`, { headers: { Accept: "application/json" } });
      if (!upstream.ok) return jsonResponse(res, 502, { error: "Upstream error" });
      const data = await upstream.json();
      if (data.code !== "0" || !data.data?.[0]) return jsonResponse(res, 502, { error: "OKX error" });
      const t = data.data[0];
      return jsonResponse(res, 200, {
        symbol: sym, price: parseFloat(t.last), change24h: parseFloat(t.change24h),
        changePercent24h: (parseFloat(t.change24h) / parseFloat(t.open24h)) * 100,
        high24h: parseFloat(t.high24h), low24h: parseFloat(t.low24h), volume24h: parseFloat(t.vol24h),
      });
    }

    // ── Market Klines ──
    if (path === "/api/market/klines") {
      const symbol = url.searchParams.get("symbol") || "BTC";
      const interval = url.searchParams.get("interval") || "1h";
      const limit = Math.min(300, parseInt(url.searchParams.get("limit") || "60", 10));
      const sym = symbol.toUpperCase();
      const instId = SYMBOL_TO_OKX[sym];
      const bar = INTERVAL_TO_OKX[interval.toLowerCase()];
      if (!instId) return jsonResponse(res, 400, { error: "Unknown symbol" });
      if (!bar) return jsonResponse(res, 400, { error: "Unsupported interval" });

      const upstream = await fetch(`${OKX_BASE}/candles?instId=${instId}&bar=${bar}&limit=${limit}`, { headers: { Accept: "application/json" } });
      if (!upstream.ok) return jsonResponse(res, 502, { error: "Upstream error" });
      const data = await upstream.json();
      if (data.code !== "0" || !Array.isArray(data.data)) return jsonResponse(res, 502, { error: "OKX error" });
      const result = data.data.filter(c => c[4] && parseFloat(c[4]) > 0).reverse().map(c => [Number(c[0]), c[1], c[2], c[3], c[4], c[5]]);
      return jsonResponse(res, 200, result);
    }

    // ── AI Analyze ──
    if (path === "/api/ai/analyze") {
      if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
      const body = await readBody(req);
      const { symbol, price, change24h, radarScore, bias } = JSON.parse(body);
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return jsonResponse(res, 200, {
          symbol, price,
          analysis: `Análisis de ${symbol} a $${price}. Cambio 24h: ${change24h || 'N/A'}. Score: ${radarScore || 'N/A'}. Sesgo: ${bias || 'N/A'}.`,
          recommendation: radarScore > 70 ? "Strong Buy" : radarScore > 50 ? "Hold" : "Caution",
          timestamp: new Date().toISOString()
        });
      }
      const prompt = `Analyze ${symbol} at $${price}. 24h change: ${change24h || 'N/A'}. Score: ${radarScore || 'N/A'}/100. Bias: ${bias || 'N/A'}. Give 2-3 sentence trading analysis.`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 150 })
      });
      const aiData = await aiRes.json();
      const analysis = aiData.choices?.[0]?.message?.content || "No analysis available";
      return jsonResponse(res, 200, { symbol, price, analysis, recommendation: radarScore > 70 ? "Strong Buy" : radarScore > 50 ? "Hold" : "Caution", timestamp: new Date().toISOString() });
    }

    // ── Contact Email ──
    if (path === "/api/ai/contact") {
      if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
      const body = await readBody(req);
      const { name, email, message, subject } = JSON.parse(body);
      if (!message || message.trim().length < 5) return jsonResponse(res, 400, { error: "Mensaje muy corto" });
      const mailContent = `Nueva consulta de soporte — Liquidity Radar Crypto\n===================================================\nNombre: ${name || "No proporcionado"}\nEmail: ${email || "No proporcionado"}\nAsunto: ${subject || "Consulta general"}\nFecha: ${new Date().toLocaleString("es-ES")}\n\nMensaje:\n${message}`;
      const result = await sendEmail({
        to: MAIL_ADMIN,
        subject: `[Soporte LR] ${subject || "Nueva consulta"} - ${name || email || "usuario"}`,
        text: mailContent,
      });
      return jsonResponse(res, 200, result);
    }

    // ── Alert Email ──
    if (path === "/api/ai/alert-email") {
      if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
      const body = await readBody(req);
      const { email, symbol, condition, targetPrice, currentPrice } = JSON.parse(body);
      if (!email || !symbol || !targetPrice) return jsonResponse(res, 200, { ok: true });
      const conditionText = condition === 'above' ? 'superó' : 'cayó por debajo de';
      const fmt = (n) => n >= 1 ? `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toFixed(4)}`;
      const subject = `🚨 Alerta: ${symbol} ${conditionText} ${fmt(targetPrice)}`;
      const text = `Tu alerta se ha disparado.\n\n${symbol} ${conditionText} ${fmt(targetPrice)}\nPrecio actual: ${fmt(currentPrice)}\nFecha: ${new Date().toLocaleString('es-ES')}\n\nGestiona tus alertas en Liquidity Radar Crypto.`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px"><div style="max-width:420px;margin:0 auto"><h1 style="color:#f7931a;font-family:monospace;font-size:22px;text-align:center;margin-bottom:24px">⚡ Liquidity Radar Crypto</h1><div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px"><div style="font-size:32px;text-align:center;margin-bottom:12px">🚨</div><h2 style="margin:0 0 12px;font-size:18px;text-align:center">Alerta Disparada</h2><div style="background:#0d1117;border-radius:8px;padding:16px;text-align:center"><p style="font-size:24px;font-family:monospace;color:#f7931a;margin:0 0 4px;font-weight:700">${symbol}</p><p style="margin:0;color:#8b949e;font-size:14px">${conditionText} <strong style="color:#e6edf3">${fmt(targetPrice)}</strong></p><p style="margin:8px 0 0;color:#8b949e;font-size:13px">Precio actual: <strong style="color:#e6edf3">${fmt(currentPrice)}</strong></p></div><p style="text-align:center;color:#8b949e;font-size:12px;margin-top:16px">${new Date().toLocaleString('es-ES')}</p></div><p style="text-align:center;color:#484f58;font-size:11px;margin-top:16px">Liquidity Radar Crypto</p></div></body></html>`;
      const result = await sendEmail({ to: email, subject, text, html });
      return jsonResponse(res, 200, result);
    }

    // ── Onboarding Email ──
    if (path === "/api/ai/onboarding") {
      if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
      const body = await readBody(req);
      const { name, email, nickname, phone } = JSON.parse(body);
      if (!email) return jsonResponse(res, 200, { ok: true });
      const firstName = (name || email).split(' ')[0];
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px"><div style="max-width:480px;margin:0 auto"><div style="text-align:center;margin-bottom:28px"><div style="font-size:44px">⚡</div><h1 style="color:#f7931a;font-size:24px;margin:8px 0;font-family:monospace">Liquidity Radar Crypto</h1></div><div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;margin-bottom:20px"><h2 style="margin:0 0 12px;font-size:18px">Hola, ${firstName}! 👋</h2><p style="color:#8b949e;margin:0 0 16px;font-size:14px">Tu cuenta ha sido creada. Bienvenido a <strong style="color:#e6edf3">LRC</strong>.</p><div style="background:#0d1117;border-radius:8px;padding:16px"><p style="margin:0 0 10px;font-size:13px;color:#f7931a;font-weight:600">¿Qué puedes hacer?</p><ul style="margin:0;padding:0 0 0 18px;color:#8b949e;font-size:13px;line-height:2.2"><li>📡 Radar Score de liquidez</li><li>📊 Gráficos técnicos</li><li>🔔 Alertas de precio</li><li>🏟️ Arena Simulator</li><li>🤖 Análisis AI</li></ul></div></div><p style="text-align:center;color:#484f58;font-size:11px">Responde a este correo si tienes dudas</p></div></body></html>`;
      const text = `Hola ${firstName}!\n\nTu cuenta en Liquidity Radar Crypto ha sido creada.\n\nYa puedes usar: radar de liquidez, gráficos, alertas, Arena Simulator y análisis AI.\n\n— Equipo LRC`;
      await sendEmail({ to: email, subject: `⚡ Bienvenido a Liquidity Radar Crypto, ${firstName}!`, text, html });
      await sendEmail({ to: MAIL_ADMIN, subject: `[LRC] Nuevo usuario — ${name || email}`, text: `Nuevo registro.\nNombre: ${name || '-'}\nEmail: ${email}\nNickname: ${nickname || '-'}\nTeléfono: ${phone || '-'}\nFecha: ${new Date().toLocaleString('es-ES')}` });
      return jsonResponse(res, 200, { ok: true });
    }

    // ── Profile Notify ──
    if (path === "/api/ai/profile-notify") {
      if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
      const body = await readBody(req);
      const { profile } = JSON.parse(body);
      if (!profile) return jsonResponse(res, 200, { ok: true });
      const content = `Nuevo perfil guardado — Liquidity Radar Crypto\n===============================================\nNombre: ${profile.name || '-'}\nNickname: ${profile.nickname || '-'}\nEmail: ${profile.email || '-'}\nTeléfono: ${profile.phone || '-'}\nPaís: ${profile.country || '-'}\nIdioma: ${profile.language || '-'}\nFecha: ${new Date().toLocaleString('es-ES')}`;
      await sendEmail({ to: MAIL_ADMIN, subject: `[LR] Perfil actualizado — ${profile.name || profile.nickname || profile.email || "usuario"}`, text: content });
      return jsonResponse(res, 200, { ok: true });
    }

    // ── Stripe Plans ──
    if (path === "/api/stripe/plans") {
      return jsonResponse(res, 200, { products: [], message: "Stripe not configured" });
    }

    // ── Push VAPID ──
    if (path === "/api/push/vapid-key") {
      const key = process.env.VAPID_PUBLIC_KEY;
      if (!key) return jsonResponse(res, 503, { error: "Push not configured" });
      return jsonResponse(res, 200, { publicKey: key });
    }

    // 404
    return jsonResponse(res, 404, { error: "Not found", path });
  } catch (err) {
    console.error("API error:", err);
    return jsonResponse(res, 500, { error: err.message || "Internal error" });
  }
}
