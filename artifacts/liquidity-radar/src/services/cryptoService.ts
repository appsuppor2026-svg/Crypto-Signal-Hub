const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const KRAKEN_REST    = 'https://api.kraken.com/0/public';

export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  SOL:  'solana',
  XRP:  'ripple',
  BNB:  'binancecoin',
  DOGE: 'dogecoin',
};

export const SYMBOL_TO_KRAKEN: Record<string, string> = {
  BTC:  'BTC/USD',
  ETH:  'ETH/USD',
  SOL:  'SOL/USD',
  XRP:  'XRP/USD',
  BNB:  'BNB/USD',
  DOGE: 'DOGE/USD',
};

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

// ── Module-level cache (survives re-renders, resets on page reload) ────────────
interface CacheEntry<T> { data: T; ts: number; }
const _cache   = new Map<string, CacheEntry<unknown>>();
const _inflight = new Map<string, Promise<unknown>>();

const TTL_MINUTELY = 3 * 60_000;   // 3 min
const TTL_OHLC     = 5 * 60_000;   // 5 min
const TTL_PRICE    = 30_000;        // 30 s

async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Fresh cache hit
  const hit = _cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.ts < ttl) return hit.data;

  // Deduplicate in-flight requests
  if (_inflight.has(key)) return _inflight.get(key) as Promise<T>;

  const promise = fetcher()
    .then(data => {
      _inflight.delete(key);
      const isUsable = Array.isArray(data) ? (data as unknown[]).length > 0 : data != null;
      if (isUsable) _cache.set(key, { data, ts: Date.now() });
      return data;
    })
    .catch((err: unknown) => {
      _inflight.delete(key);
      // Serve stale cache on any error (including 429)
      const stale = _cache.get(key) as CacheEntry<T> | undefined;
      if (stale) return stale.data;
      throw err;
    });

  _inflight.set(key, promise as Promise<unknown>);
  return promise;
}

// ── Date formatters ───────────────────────────────────────────────────────────
function fmtTime(ts: number, tf: ChartTimeframe): string {
  const d = new Date(ts);
  const DAY = ['D','L','M','X','J','V','S'];
  const hh  = d.getHours().toString().padStart(2, '0');
  const mm  = d.getMinutes().toString().padStart(2, '0');
  switch (tf) {
    case '5M': case '15M': case '1H': case '1D': return `${hh}:${mm}`;
    case '4H': return `${DAY[d.getDay()]} ${hh}h`;
    case '7D': return `${DAY[d.getDay()]}${hh}h`;
    case '1M': return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}

// ── Aggregate minutely prices → OHLC buckets ─────────────────────────────────
function aggregateOHLC(
  prices: [number, number][],
  bucketMs: number,
  tf: ChartTimeframe,
  maxCandles = 80
): OHLCPoint[] {
  if (!prices.length) return [];
  const map = new Map<number, { o: number; h: number; l: number; c: number }>();
  for (const [ts, price] of prices) {
    const key = Math.floor(ts / bucketMs) * bucketMs;
    const ex  = map.get(key);
    if (!ex) { map.set(key, { o: price, h: price, l: price, c: price }); }
    else { ex.h = Math.max(ex.h, price); ex.l = Math.min(ex.l, price); ex.c = price; }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .slice(-maxCandles)
    .map(([ts, b]) => ({ date: fmtTime(ts, tf), timestamp: ts, open: b.o, high: b.h, low: b.l, close: b.c }));
}

// ── Fetch raw minutely prices from CoinGecko (last 24 h) — cached ────────────
async function fetchMinutely(symbol: string): Promise<[number, number][]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  return withCache(`minutely_${symbol}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1&interval=minutely`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    return (data.prices ?? []) as [number, number][];
  }, TTL_MINUTELY);
}

// ── CoinGecko OHLC — cached ───────────────────────────────────────────────────
async function fetchCoinGeckoOHLC(symbol: string, days: number, tf: ChartTimeframe): Promise<OHLCPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  return withCache(`ohlc_${symbol}_${days}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
    const raw: [number, number, number, number, number][] = await res.json();
    return raw.map(([ts, open, high, low, close]) => ({
      date: fmtTime(ts, tf), timestamp: ts, open, high, low, close,
    }));
  }, TTL_OHLC);
}

// ── Kraken OHLC REST (fallback only) ─────────────────────────────────────────
const KRAKEN_PAIR: Record<string, string> = {
  BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', XRP: 'XRPUSD', DOGE: 'XDGUSD',
};

async function fetchKrakenOHLC(symbol: string, intervalMin: number, tf: ChartTimeframe): Promise<OHLCPoint[]> {
  const pair = KRAKEN_PAIR[symbol];
  if (!pair) return [];
  const since = Math.floor(Date.now() / 1000) - intervalMin * 80 * 60;
  try {
    const res = await fetch(
      `${KRAKEN_REST}/OHLC?pair=${pair}&interval=${intervalMin}&since=${since}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (json.error?.length) return [];
    const result = json.result as Record<string, unknown>;
    const key = Object.keys(result).find(k => k !== 'last');
    if (!key) return [];
    const raw = result[key] as [number, string, string, string, string][];
    return raw.map(([ts, open, high, low, close]) => ({
      date: fmtTime(ts * 1000, tf), timestamp: ts * 1000,
      open: parseFloat(open), high: parseFloat(high),
      low:  parseFloat(low),  close: parseFloat(close),
    }));
  } catch { return []; }
}

// ── Public: fetchOHLCData ─────────────────────────────────────────────────────
export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  switch (timeframe) {
    case '5M': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      if (min.length) return aggregateOHLC(min, 5 * 60_000, '5M', 60);
      return fetchKrakenOHLC(symbol, 5, '5M');
    }
    case '15M': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      if (min.length) return aggregateOHLC(min, 15 * 60_000, '15M', 60);
      return fetchKrakenOHLC(symbol, 15, '15M');
    }
    case '1H': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      if (min.length) return aggregateOHLC(min, 60 * 60_000, '1H', 24);
      return fetchKrakenOHLC(symbol, 60, '1H');
    }
    case '4H': return fetchCoinGeckoOHLC(symbol, 7, '4H');
    case '1D': return fetchCoinGeckoOHLC(symbol, 1, '1D');
    case '7D': return fetchCoinGeckoOHLC(symbol, 7, '7D');
    case '1M': return fetchCoinGeckoOHLC(symbol, 30, '1M');
  }
}

// ── Public: fetchChartDataByTimeframe (line chart — reuses minutely cache) ───
export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];

  if (['5M', '15M', '1H', '4H'].includes(timeframe)) {
    const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
    if (!min.length) return [];
    const stepMin = timeframe === '5M' ? 5 : timeframe === '15M' ? 15 : timeframe === '1H' ? 30 : 60;
    return min
      .filter((_, i) => i % stepMin === 0)
      .map(([ts, price]) => ({ date: fmtTime(ts, timeframe), price }));
  }

  const cfgMap: Record<string, { days: number; interval: string }> = {
    '1D': { days: 1,  interval: 'hourly' },
    '7D': { days: 7,  interval: 'daily'  },
    '1M': { days: 30, interval: 'daily'  },
  };
  const cfg = cfgMap[timeframe];
  if (!cfg) return [];

  return withCache(`line_${symbol}_${timeframe}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${cfg.days}&interval=${cfg.interval}`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko line ${res.status}`);
    const data = await res.json();
    return (data.prices as [number, number][]).map(([ts, price]) => ({
      date: fmtTime(ts, timeframe), price,
    }));
  }, TTL_OHLC);
}

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}

// ── Public: fetchCoinPrice — cached ──────────────────────────────────────────
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
