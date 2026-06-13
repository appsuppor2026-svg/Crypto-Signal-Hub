const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const KRAKEN_REST = 'https://api.kraken.com/0/public';

export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
};

export const SYMBOL_TO_KRAKEN: Record<string, string> = {
  BTC: 'BTC/USD',
  ETH: 'ETH/USD',
  SOL: 'SOL/USD',
  XRP: 'XRP/USD',
  BNB: 'BNB/USD',
  DOGE: 'DOGE/USD',
};

// Kraken REST pair names for OHLC
const SYMBOL_TO_KRAKEN_REST: Record<string, string> = {
  BTC: 'XBTUSD',
  ETH: 'ETHUSD',
  SOL: 'SOLUSD',
  XRP: 'XRPUSD',
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

export async function fetchCoinPrice(symbol: string): Promise<CoinGeckoPrice | null> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return null;
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[id] ?? null;
  } catch {
    return null;
  }
}

export type ChartTimeframe = '5M' | '15M' | '1H' | '4H' | '1D' | '7D' | '1M';

// Kraken OHLC intervals in minutes
const KRAKEN_TF_MAP: Partial<Record<ChartTimeframe, number>> = {
  '5M': 5,
  '15M': 15,
  '1H': 60,
  '4H': 240,
};

export interface OHLCPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function fmtTime(ts: number, tf: ChartTimeframe): string {
  const d = new Date(ts);
  if (tf === '5M' || tf === '15M') {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (tf === '1H') {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (tf === '4H') {
    return `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]} ${d.getHours()}h`;
  }
  if (tf === '1D') {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (tf === '7D') {
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// Fetch sub-day candles from Kraken REST
async function fetchKrakenOHLC(symbol: string, intervalMin: number, tf: ChartTimeframe): Promise<OHLCPoint[]> {
  const pair = SYMBOL_TO_KRAKEN_REST[symbol];
  if (!pair) return [];

  // since = now - (interval * candles) seconds
  const candles = 60;
  const since = Math.floor(Date.now() / 1000) - intervalMin * candles * 60;

  try {
    const res = await fetch(
      `${KRAKEN_REST}/OHLC?pair=${pair}&interval=${intervalMin}&since=${since}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (json.error?.length) return [];

    const result = json.result as Record<string, any>;
    const key = Object.keys(result).find(k => k !== 'last');
    if (!key) return [];

    const raw: [number, string, string, string, string, string, string, number][] = result[key];
    return raw.map(([ts, open, high, low, close]) => ({
      date: fmtTime(ts * 1000, tf),
      timestamp: ts * 1000,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
    }));
  } catch {
    return [];
  }
}

export async function fetchOHLCData(symbol: string, timeframe: ChartTimeframe): Promise<OHLCPoint[]> {
  // Sub-day timeframes via Kraken REST
  if (timeframe in KRAKEN_TF_MAP) {
    const interval = KRAKEN_TF_MAP[timeframe]!;
    const data = await fetchKrakenOHLC(symbol, interval, timeframe);
    if (data.length > 0) return data;
    // fallback to CoinGecko 1D
  }

  // CoinGecko OHLC for 1D/7D/1M
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];

  const daysMap: Partial<Record<ChartTimeframe, number>> = { '1D': 1, '7D': 7, '1M': 30 };
  const days = daysMap[timeframe] ?? 1;

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const raw: [number, number, number, number, number][] = await res.json();

    return raw.map(([ts, open, high, low, close]) => ({
      date: fmtTime(ts, timeframe),
      timestamp: ts,
      open, high, low, close,
    }));
  } catch {
    return [];
  }
}

export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];

  // For sub-day: use market_chart minutely (last 24h)
  if (['5M', '15M', '1H', '4H'].includes(timeframe)) {
    try {
      const res = await fetch(
        `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1&interval=minutely`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const prices: [number, number][] = data.prices;
      // thin out based on timeframe
      const step = timeframe === '5M' ? 5 : timeframe === '15M' ? 15 : timeframe === '1H' ? 60 : 240;
      const filtered = prices.filter((_, i) => i % step === 0);
      return filtered.map(([ts, price]) => ({
        date: fmtTime(ts, timeframe),
        price,
      }));
    } catch {
      return [];
    }
  }

  const params: Partial<Record<ChartTimeframe, { days: number; interval: string }>> = {
    '1D': { days: 1, interval: 'hourly' },
    '7D': { days: 7, interval: 'daily' },
    '1M': { days: 30, interval: 'daily' },
  };

  const p = params[timeframe];
  if (!p) return [];

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${p.days}&interval=${p.interval}`,
      { signal: AbortSignal.timeout(8000) }
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
