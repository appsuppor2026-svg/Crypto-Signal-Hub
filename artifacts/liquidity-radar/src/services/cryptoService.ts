// ── API bases ─────────────────────────────────────────────────────────────────
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Production API URL (Vercel backend) or fallback to same-origin
const _rawBase = (import.meta.env.VITE_API_URL ?? (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') + '/api').replace(/\/$/, '');
const API_BASE = _rawBase;

// ── Symbol maps ───────────────────────────────────────────────────────────────
export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  SOL:  'solana',
  XRP:  'ripple',
  BNB:  'binancecoin',
  DOGE: 'dogecoin',
};

// Kraken WS pairs (real-time price streaming)
export const SYMBOL_TO_KRAKEN: Record<string, string> = {
  BTC:  'BTC/USD',
  ETH:  'ETH/USD',
  SOL:  'SOL/USD',
  XRP:  'XRP/USD',
  BNB:  'BNB/USD',
  DOGE: 'DOGE/USD',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CoinGeckoPrice {
  usd: number;
  usd_24h_change: number;
}

export interface ChartPoint {
  date: string;
  price: number;
}

export interface OHLCPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ChartTimeframe = '5M' | '15M' | '1H' | '4H' | '1D' | '7D' | '1M';

// ── Module-level cache + request deduplication ────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }
const _cache    = new Map<string, CacheEntry<unknown>>();
const _inflight = new Map<string, Promise<unknown>>();

const TTL_SHORT  = 2 * 60_000;
const TTL_MEDIUM = 5 * 60_000;
const TTL_LONG   = 10 * 60_000;
const TTL_PRICE  = 30_000;

async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const hit = _cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  if (_inflight.has(key)) return _inflight.get(key) as Promise<T>;

  const promise = fetcher()
    .then(data => {
      _inflight.delete(key);
      const ok = Array.isArray(data) ? (data as unknown[]).length > 0 : data != null;
      if (ok) _cache.set(key, { data, ts: Date.now() });
      return data;
    })
    .catch((err: unknown) => {
      _inflight.delete(key);
      const stale = _cache.get(key) as CacheEntry<T> | undefined;
      if (stale) return stale.data;
      throw err;
    });

  _inflight.set(key, promise as Promise<unknown>);
  return promise;
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtTime(ts: number, tf: ChartTimeframe): string {
  const d   = new Date(ts);
  const DAY = ['D','L','M','X','J','V','S'];
  const hh  = d.getHours().toString().padStart(2, '0');
  const mm  = d.getMinutes().toString().padStart(2, '0');
  switch (tf) {
    case '5M': case '15M': case '1H': return `${hh}:${mm}`;
    case '4H': return `${DAY[d.getDay()]} ${hh}h`;
    case '1D': case '7D': case '1M':
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}

// ── Fetch OHLCV via our own server proxy (no CORS issues) ─────────────────────
// API server calls Binance server-side and returns the raw klines array.
// Binance klines format: [openTime, open, high, low, close, volume, ...]
async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
  tf: ChartTimeframe,
  ttl: number
): Promise<OHLCPoint[]> {
  return withCache(`klines_${symbol}_${interval}_${limit}`, async () => {
    const url = `${API_BASE}/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`klines ${res.status}`);
    const raw: unknown[][] = await res.json();
    return raw.map(c => ({
      date:      fmtTime(Number(c[0]), tf),
      timestamp: Number(c[0]),
      open:      parseFloat(c[1] as string),
      high:      parseFloat(c[2] as string),
      low:       parseFloat(c[3] as string),
      close:     parseFloat(c[4] as string),
    }));
  }, ttl);
}

// ── Public: fetchOHLCData — all timeframes through the API proxy ──────────────
export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  switch (timeframe) {
    case '5M':  return fetchKlines(symbol, '5m',  100, '5M',  TTL_SHORT);
    case '15M': return fetchKlines(symbol, '15m', 100, '15M', TTL_SHORT);
    case '1H':  return fetchKlines(symbol, '1h',  100, '1H',  TTL_SHORT);
    case '4H':  return fetchKlines(symbol, '4h',  100, '4H',  TTL_MEDIUM);
    case '1D':  return fetchKlines(symbol, '1d',  100, '1D',  TTL_LONG);
    case '7D':  return fetchKlines(symbol, '1d',  200, '7D',  TTL_LONG);
    case '1M':  return fetchKlines(symbol, '1d',  200, '1M',  TTL_LONG);
  }
}

// ── Public: fetchChartDataByTimeframe — line chart derived from klines ────────
export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const ohlc = await fetchOHLCData(symbol, timeframe).catch(() => [] as OHLCPoint[]);
  return ohlc.map(c => ({ date: c.date, price: c.close }));
}

// Alias for useAssetData initial 7D line chart
export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}

// ── Public: fetchCoinPrice — CoinGecko simple/price, cached 30 s ─────────────
export async function fetchCoinPrice(symbol: string): Promise<CoinGeckoPrice | null> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return null;
  return withCache(`price_${symbol}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko price ${res.status}`);
    const data = await res.json();
    return (data[id] ?? null) as CoinGeckoPrice | null;
  }, TTL_PRICE);
}
