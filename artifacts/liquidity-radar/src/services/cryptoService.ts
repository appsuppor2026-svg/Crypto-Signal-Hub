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

// Kraken REST pair names for OHLC
const SYMBOL_TO_KRAKEN_REST: Record<string, string> = {
  BTC:  'XBTUSD',
  ETH:  'ETHUSD',
  SOL:  'SOLUSD',
  XRP:  'XRPUSD',
  DOGE: 'XDGUSD',
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
  switch (tf) {
    case '5M':
    case '15M':
    case '1H':
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    case '4H':
      return `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]} ${d.getHours()}h`;
    case '1D':
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    case '7D':
      return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
    case '1M':
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}

// ── Kraken OHLC REST ─────────────────────────────────────────────────────────
const KRAKEN_TF_MIN: Partial<Record<ChartTimeframe, number>> = {
  '5M': 5, '15M': 15, '1H': 60, '4H': 240,
};

async function fetchKrakenOHLC(symbol: string, intervalMin: number, tf: ChartTimeframe): Promise<OHLCPoint[]> {
  const pair = SYMBOL_TO_KRAKEN_REST[symbol];
  if (!pair) return [];

  // Request enough candles: 80 candles back
  const since = Math.floor(Date.now() / 1000) - intervalMin * 80 * 60;

  try {
    const res = await fetch(
      `${KRAKEN_REST}/OHLC?pair=${pair}&interval=${intervalMin}&since=${since}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (json.error?.length) return [];

    const result = json.result as Record<string, unknown>;
    const key = Object.keys(result).find(k => k !== 'last');
    if (!key) return [];

    const raw = result[key] as [number, string, string, string, string, string, string, number][];
    return raw.map(([ts, open, high, low, close]) => ({
      date:      fmtTime(ts * 1000, tf),
      timestamp: ts * 1000,
      open:      parseFloat(open),
      high:      parseFloat(high),
      low:       parseFloat(low),
      close:     parseFloat(close),
    }));
  } catch {
    return [];
  }
}

// ── CoinGecko OHLC ───────────────────────────────────────────────────────────
// days=1  → 30-min candles   (~48 pts)
// days=7  → 4-hour candles   (~42 pts)
// days=30 → daily candles    (~30 pts)
async function fetchCoinGeckoOHLC(symbol: string, days: number, tf: ChartTimeframe): Promise<OHLCPoint[]> {
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

// ── Public: fetchOHLCData ────────────────────────────────────────────────────
export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  switch (timeframe) {
    case '5M':
    case '15M': {
      // Kraken primary, no CoinGecko fallback for very short TFs
      const intervalMin = KRAKEN_TF_MIN[timeframe]!;
      return fetchKrakenOHLC(symbol, intervalMin, timeframe);
    }
    case '1H': {
      // Try Kraken first; fallback to CoinGecko 1-day (30-min candles)
      const kr = await fetchKrakenOHLC(symbol, 60, '1H');
      if (kr.length > 0) return kr;
      return fetchCoinGeckoOHLC(symbol, 1, '1H');
    }
    case '4H': {
      // CoinGecko days=7 naturally returns 4H candles; Kraken as bonus
      const cg = await fetchCoinGeckoOHLC(symbol, 7, '4H');
      if (cg.length > 0) return cg;
      return fetchKrakenOHLC(symbol, 240, '4H');
    }
    case '1D':
      return fetchCoinGeckoOHLC(symbol, 1, '1D');
    case '7D':
      return fetchCoinGeckoOHLC(symbol, 7, '7D');
    case '1M':
      return fetchCoinGeckoOHLC(symbol, 30, '1M');
  }
}

// ── CoinGecko price ──────────────────────────────────────────────────────────
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

  // For sub-day timeframes use the 1-day market_chart (minutely)
  if (['5M', '15M', '1H', '4H'].includes(timeframe)) {
    try {
      const res = await fetch(
        `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1&interval=minutely`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();
      const prices: [number, number][] = data.prices ?? [];

      // Thin-out: keep 1 point every N minutes so we get ~60-80 visible points
      const stepMin = timeframe === '5M' ? 5 : timeframe === '15M' ? 15 : timeframe === '1H' ? 30 : 60;
      return prices
        .filter((_, i) => i % stepMin === 0)
        .map(([ts, price]) => ({ date: fmtTime(ts, timeframe), price }));
    } catch {
      return [];
    }
  }

  // Daily/weekly/monthly
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
      date: fmtTime(ts, timeframe),
      price,
    }));
  } catch {
    return [];
  }
}

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}
