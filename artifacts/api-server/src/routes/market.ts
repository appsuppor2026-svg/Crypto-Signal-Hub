import { Router } from "express";

const router = Router();

const OKX_BASE = "https://www.okx.com/api/v5/market";

// OKX uses instId format: BTC-USDT
const SYMBOL_TO_OKX: Record<string, string> = {
  BTC:  "BTC-USDT",
  ETH:  "ETH-USDT",
  SOL:  "SOL-USDT",
  XRP:  "XRP-USDT",
  BNB:  "BNB-USDT",
  DOGE: "DOGE-USDT",
};

// Map Binance-style interval strings → OKX bar param
// OKX intervals: 1m 3m 5m 15m 30m 1H 2H 4H 6H 12H 1D 2D 3D 1W 1M
const INTERVAL_TO_OKX: Record<string, string> = {
  "1m":  "1m",
  "5m":  "5m",
  "15m": "15m",
  "30m": "30m",
  "1h":  "1H",
  "2h":  "2H",
  "4h":  "4H",
  "6h":  "6H",
  "12h": "12H",
  "1d":  "1D",
  "1w":  "1W",
};

// Server-side cache — 1 min TTL
const _cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

/**
 * GET /api/market/ticker?symbol=BTC
 *
 * Returns current price and 24h change from OKX.
 */
router.get("/ticker", async (req: any, res: any) => {
  const { symbol } = req.query as Record<string, string>;
  const sym = symbol?.toUpperCase();
  const instId = sym ? SYMBOL_TO_OKX[sym] : undefined;
  if (!instId) {
    res.status(400).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }

  try {
    const url = `${OKX_BASE}/ticker?instId=${instId}`;
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    }) as any;

    if (!upstream.ok) {
      req.log?.warn?.({ status: upstream.status }, "OKX ticker error");
      res.status(502).json({ error: `Upstream ${upstream.status}` });
      return;
    }

    const json = await upstream.json() as { code: string; data: any[] };
    if (json.code !== "0" || !Array.isArray(json.data) || !json.data[0]) {
      res.status(502).json({ error: "OKX returned error" });
      return;
    }

    const t = json.data[0];
    res.json({
      symbol: sym,
      price: parseFloat(t.last),
      change24h: parseFloat(t.change24h),
      changePercent24h: (parseFloat(t.change24h) / parseFloat(t.open24h)) * 100,
      high24h: parseFloat(t.high24h),
      low24h: parseFloat(t.low24h),
      volume24h: parseFloat(t.vol24h),
    });
  } catch (err: any) {
    req.log?.warn?.({ err: err.message }, "ticker fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

/**
 * GET /api/market/klines?symbol=BTC&interval=1h&limit=48
 *
 * Returns data in Binance klines format so the frontend needs no changes:
 * [ [openTime_ms, open, high, low, close, volume], ... ]
 * Data is sorted ascending (oldest → newest).
 */
router.get("/klines", async (req: any, res: any) => {
  const { symbol, interval, limit } = req.query as Record<string, string>;

  const sym    = symbol?.toUpperCase();
  const instId = sym ? SYMBOL_TO_OKX[sym] : undefined;
  if (!instId) {
    res.status(400).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }

  const bar = interval ? INTERVAL_TO_OKX[interval.toLowerCase()] : undefined;
  if (!bar) {
    res.status(400).json({ error: `Unsupported interval: ${interval}` });
    return;
  }

  // OKX max 300 candles per request
  const lim = Math.max(1, Math.min(300, parseInt(limit ?? "60", 10)));

  const cacheKey = `${sym}_${bar}_${lim}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL) {
    res.json(hit.data);
    return;
  }

  try {
    const url = `${OKX_BASE}/candles?instId=${instId}&bar=${bar}&limit=${lim}`;

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    }) as any;

    if (!upstream.ok) {
      req.log?.warn?.({ status: upstream.status }, "OKX error");
      res.status(502).json({ error: `Upstream ${upstream.status}` });
      return;
    }

    const json = await upstream.json() as { code: string; data: string[][] };

    if (json.code !== "0" || !Array.isArray(json.data)) {
      req.log?.warn?.({ code: json.code }, "OKX bad response");
      res.status(502).json({ error: "OKX returned error" });
      return;
    }

    // OKX returns newest-first; reverse for chronological order.
    // OKX row: [ts_ms, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
    // Binance row: [openTime_ms, open, high, low, close, volume, ...]
    const result = json.data
      .filter(c => c[4] && parseFloat(c[4]) > 0) // skip empty candles (confirm=0 unfinished)
      .reverse()
      .map(c => [
        Number(c[0]),  // openTime ms
        c[1],          // open
        c[2],          // high
        c[3],          // low
        c[4],          // close
        c[5],          // volume
      ]);

    _cache.set(cacheKey, { data: result, ts: Date.now() });
    res.json(result);
  } catch (err: any) {
    req.log?.warn?.({ err: err.message }, "klines fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

export default router;
