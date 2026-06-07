const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  XRP: 'ripple',
};

export const SYMBOL_TO_KRAKEN: Record<string, string> = {
  BTC: 'BTC/USD',
  XRP: 'XRP/USD',
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

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=7&interval=daily`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (data.prices as [number, number][]).map(([ts, price]) => ({
      date: days[new Date(ts).getDay()],
      price,
    }));
  } catch {
    return [];
  }
}
