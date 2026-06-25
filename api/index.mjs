// Liquidity Radar API — Minimal Vercel Serverless Function
// No DB, no Stripe, no complex deps — just OKX proxy + OpenAI

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
    // Health check
    if (path === "/api/healthz" || path === "/healthz") {
      return jsonResponse(res, 200, { status: "ok", time: new Date().toISOString() });
    }

    // API info
    if (path === "/api" || path === "/api/" || path === "/") {
      return jsonResponse(res, 200, {
        message: "Liquidity Radar API",
        version: "1.0.0",
        routes: [
          "/api/healthz",
          "/api/market/ticker",
          "/api/market/klines",
          "/api/ai/analyze",
          "/api/stripe/plans",
          "/api/push/vapid-key"
        ]
      });
    }

    // Market ticker from OKX
    if (path === "/api/market/ticker") {
      const symbol = url.searchParams.get("symbol") || "BTC";
      const sym = symbol.toUpperCase();
      const instId = SYMBOL_TO_OKX[sym];
      if (!instId) return jsonResponse(res, 400, { error: "Unknown symbol" });

      const upstream = await fetch(`${OKX_BASE}/ticker?instId=${instId}`, {
        headers: { Accept: "application/json" }
      });
      if (!upstream.ok) return jsonResponse(res, 502, { error: "Upstream error" });

      const data = await upstream.json();
      if (data.code !== "0" || !data.data?.[0]) return jsonResponse(res, 502, { error: "OKX error" });

      const t = data.data[0];
      return jsonResponse(res, 200, {
        symbol: sym,
        price: parseFloat(t.last),
        change24h: parseFloat(t.change24h),
        changePercent24h: (parseFloat(t.change24h) / parseFloat(t.open24h)) * 100,
        high24h: parseFloat(t.high24h),
        low24h: parseFloat(t.low24h),
        volume24h: parseFloat(t.vol24h),
      });
    }

    // Market klines from OKX
    if (path === "/api/market/klines") {
      const symbol = url.searchParams.get("symbol") || "BTC";
      const interval = url.searchParams.get("interval") || "1h";
      const limit = Math.min(300, parseInt(url.searchParams.get("limit") || "60", 10));
      const sym = symbol.toUpperCase();
      const instId = SYMBOL_TO_OKX[sym];
      const bar = INTERVAL_TO_OKX[interval.toLowerCase()];
      if (!instId) return jsonResponse(res, 400, { error: "Unknown symbol" });
      if (!bar) return jsonResponse(res, 400, { error: "Unsupported interval" });

      const upstream = await fetch(
        `${OKX_BASE}/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
        { headers: { Accept: "application/json" } }
      );
      if (!upstream.ok) return jsonResponse(res, 502, { error: "Upstream error" });

      const data = await upstream.json();
      if (data.code !== "0" || !Array.isArray(data.data)) return jsonResponse(res, 502, { error: "OKX error" });

      const result = data.data
        .filter(c => c[4] && parseFloat(c[4]) > 0)
        .reverse()
        .map(c => [Number(c[0]), c[1], c[2], c[3], c[4], c[5]]);
      return jsonResponse(res, 200, result);
    }

    // AI analyze (placeholder if no API key)
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
      
      // OpenAI call
      const prompt = `Analyze ${symbol} at $${price}. 24h change: ${change24h || 'N/A'}. Score: ${radarScore || 'N/A'}/100. Bias: ${bias || 'N/A'}. Give 2-3 sentence trading analysis.`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 150 })
      });
      const aiData = await aiRes.json();
      const analysis = aiData.choices?.[0]?.message?.content || "No analysis available";
      
      return jsonResponse(res, 200, {
        symbol, price, analysis,
        recommendation: radarScore > 70 ? "Strong Buy" : radarScore > 50 ? "Hold" : "Caution",
        timestamp: new Date().toISOString()
      });
    }

    // Stripe plans (placeholder)
    if (path === "/api/stripe/plans") {
      return jsonResponse(res, 200, { products: [], message: "Stripe not configured" });
    }

    // Push vapid key
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
