const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

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

// ── Module-level cache + request deduplication ────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }
const _cache    = new Map<string, CacheEntry<unknown>>();
const _inflight = new Map<string, Promise<unknown>>();

const TTL_MINUTELY = 3 * 60_000;
const TTL_HOURLY   = 5 * 60_000;
const TTL_PRICE    = 30_000;

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

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtTime(ts: number, tf: ChartTimeframe): string {
  const d   = new Date(ts);
  const DAY = ['D','L','M','X','J','V','S'];
  const hh  = d.getHours().toString().padStart(2, '0');
  const mm  = d.getMinutes().toString().padStart(2, '0');
  switch (tf) {
    case '5M': case '15M': case '1H': case '1D': return `${hh}:${mm}`;
    case '4H': return `${DAY[d.getDay()]} ${hh}h`;
    case '7D': return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    case '1M': return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}

// ── Aggregate prices → OHLC buckets ──────────────────────────────────────────
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

// ── Fetch minutely (last 24 h) — cached 3 min ─────────────────────────────────
async function fetchMinutely(symbol: string): Promise<[number, number][]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  return withCache(`minutely_${symbol}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1&interval=minutely`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko minutely ${res.status}`);
    const data = await res.json();
    return (data.prices ?? []) as [number, number][];
  }, TTL_MINUTELY);
}

// ── Fetch hourly prices for longer timeframes (free API) — cached 5 min ───────
async function fetchHourly(symbol: string, days: number): Promise<[number, number][]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  return withCache(`hourly_${symbol}_${days}`, async () => {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=hourly`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko hourly ${res.status}`);
    const data = await res.json();
    return (data.prices ?? []) as [number, number][];
  }, TTL_HOURLY);
}

// ── Public: fetchOHLCData ─────────────────────────────────────────────────────
// All timeframes now use free endpoints only (no Pro OHLC)
export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  switch (timeframe) {
    case '5M': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      return aggregateOHLC(min, 5 * 60_000, '5M', 72);
    }
    case '15M': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      return aggregateOHLC(min, 15 * 60_000, '15M', 60);
    }
    case '1H': {
      const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
      return aggregateOHLC(min, 60 * 60_000, '1H', 24);
    }
    case '4H': {
      const hr = await fetchHourly(symbol, 14).catch(() => [] as [number,number][]);
      return aggregateOHLC(hr, 4 * 60 * 60_000, '4H', 60);
    }
    case '1D': {
      const hr = await fetchHourly(symbol, 30).catch(() => [] as [number,number][]);
      return aggregateOHLC(hr, 24 * 60 * 60_000, '1D', 30);
    }
    case '7D': {
      const hr = await fetchHourly(symbol, 60).catch(() => [] as [number,number][]);
      return aggregateOHLC(hr, 24 * 60 * 60_000, '7D', 60);
    }
    case '1M': {
      const hr = await fetchHourly(symbol, 90).catch(() => [] as [number,number][]);
      return aggregateOHLC(hr, 24 * 60 * 60_000, '1M', 90);
    }
  }
}

// ── Public: fetchChartDataByTimeframe (line chart) ────────────────────────────
export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];

  if (['5M', '15M', '1H'].includes(timeframe)) {
    const min = await fetchMinutely(symbol).catch(() => [] as [number,number][]);
    if (!min.length) return [];
    const stepMin = timeframe === '5M' ? 5 : timeframe === '15M' ? 15 : 30;
    return min.filter((_, i) => i % stepMin === 0).map(([ts, price]) => ({ date: fmtTime(ts, timeframe), price }));
  }

  if (timeframe === '4H') {
    const hr = await fetchHourly(symbol, 14).catch(() => [] as [number,number][]);
    return hr.filter((_, i) => i % 4 === 0).map(([ts, price]) => ({ date: fmtTime(ts, '4H'), price }));
  }

  const cfgMap: Record<string, { days: number }> = {
    '1D': { days: 30 }, '7D': { days: 60 }, '1M': { days: 90 },
  };
  const cfg = cfgMap[timeframe];
  if (!cfg) return [];
  const hr = await fetchHourly(symbol, cfg.days).catch(() => [] as [number,number][]);
  return hr.filter((_, i) => i % 24 === 0).map(([ts, price]) => ({ date: fmtTime(ts, timeframe), price }));
}

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}

// ── Public: fetchCoinPrice — cached 30 s ─────────────────────────────────────
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
