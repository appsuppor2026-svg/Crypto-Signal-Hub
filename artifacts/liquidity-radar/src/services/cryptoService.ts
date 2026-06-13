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

// ── Date formatters ──────────────────────────────────────────────────────────
function fmtTime(ts: number, tf: ChartTimeframe): string {
  const d = new Date(ts);
  const DAY = ['D','L','M','X','J','V','S'];
  const hh  = d.getHours().toString().padStart(2, '0');
  const mm  = d.getMinutes().toString().padStart(2, '0');
  switch (tf) {
    case '5M':
    case '15M':
    case '1H':
    case '1D':
      return `${hh}:${mm}`;
    case '4H':
      // CoinGecko days=7 → 4H candles; include hour so labels are unique within day
      return `${DAY[d.getDay()]} ${hh}h`;
    case '7D':
      // CoinGecko days=7 → 4H candles; include hour to prevent duplicate day labels
      return `${DAY[d.getDay()]}${hh}h`;
    case '1M':
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}

// ── Aggregate minutely prices into OHLC buckets ──────────────────────────────
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
    if (!ex) {
      map.set(key, { o: price, h: price, l: price, c: price });
    } else {
      ex.h = Math.max(ex.h, price);
      ex.l = Math.min(ex.l, price);
      ex.c = price;
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .slice(-maxCandles)
    .map(([ts, b]) => ({
      date:      fmtTime(ts, tf),
      timestamp: ts,
      open:  b.o,
      high:  b.h,
      low:   b.l,
      close: b.c,
    }));
}

// ── Fetch raw minutely prices from CoinGecko (last 24 h) ────────────────────
async function fetchMinutely(symbol: string): Promise<[number, number][]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1&interval=minutely`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.prices ?? []) as [number, number][];
  } catch {
    return [];
  }
}

// ── CoinGecko OHLC (for 4H / 1D / 7D / 1M) ─────────────────────────────────
// days=1  → 30-min candles (~48 pts)
// days=7  → 4-hour candles (~42 pts)
// days=30 → daily candles  (~30 pts)
async function fetchCoinGeckoOHLC(
  symbol: string,
  days: number,
  tf: ChartTimeframe
): Promise<OHLCPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const raw: [number, number, number, number, number][] = await res.json();
    return raw.map(([ts, open, high, low, close]) => ({
      date: fmtTime(ts, tf), timestamp: ts,
      open, high, low, close,
    }));
  } catch {
    return [];
  }
}

// ── Kraken OHLC REST (bonus attempt) ────────────────────────────────────────
const SYMBOL_TO_KRAKEN_REST: Record<string, string> = {
  BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', XRP: 'XRPUSD', DOGE: 'XDGUSD',
};

async function fetchKrakenOHLC(
  symbol: string,
  intervalMin: number,
  tf: ChartTimeframe
): Promise<OHLCPoint[]> {
  const pair = SYMBOL_TO_KRAKEN_REST[symbol];
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
  } catch {
    return [];
  }
}

// ── Public: fetchOHLCData ────────────────────────────────────────────────────
export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  switch (timeframe) {
    case '5M': {
      // Primary: aggregate CoinGecko minutely → 5-min buckets
      const min = await fetchMinutely(symbol);
      if (min.length > 0) return aggregateOHLC(min, 5 * 60_000, '5M', 60);
      // Fallback: Kraken 5-min
      return fetchKrakenOHLC(symbol, 5, '5M');
    }
    case '15M': {
      const min = await fetchMinutely(symbol);
      if (min.length > 0) return aggregateOHLC(min, 15 * 60_000, '15M', 60);
      return fetchKrakenOHLC(symbol, 15, '15M');
    }
    case '1H': {
      // Primary: aggregate CoinGecko minutely → 1H buckets (24 candles)
      const min = await fetchMinutely(symbol);
      if (min.length > 0) return aggregateOHLC(min, 60 * 60_000, '1H', 24);
      // Fallback: Kraken 60-min
      return fetchKrakenOHLC(symbol, 60, '1H');
    }
    case '4H':
      // CoinGecko days=7 naturally returns 4H candles
      return fetchCoinGeckoOHLC(symbol, 7, '4H');
    case '1D':
      // CoinGecko days=1 returns 30-min candles for the last day
      return fetchCoinGeckoOHLC(symbol, 1, '1D');
    case '7D':
      return fetchCoinGeckoOHLC(symbol, 7, '7D');
    case '1M':
      return fetchCoinGeckoOHLC(symbol, 30, '1M');
  }
}

// ── Public: fetchCoinPrice ───────────────────────────────────────────────────
export async function fetchCoinPrice(symbol: string): Promise<CoinGeckoPrice | null> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return null;
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[id] ?? null;
  } catch {
    return null;
  }
}

// ── Public: fetchChartDataByTimeframe (line chart) ───────────────────────────
export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];

  // For sub-day: use minutely data thinned to ~60-80 points
  if (['5M', '15M', '1H', '4H'].includes(timeframe)) {
    const min = await fetchMinutely(symbol);
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

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${cfg.days}&interval=${cfg.interval}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.prices as [number, number][]).map(([ts, price]) => ({
      date: fmtTime(ts, timeframe), price,
    }));
  } catch {
    return [];
  }
}

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}
