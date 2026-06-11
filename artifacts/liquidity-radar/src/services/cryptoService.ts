const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

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

export type ChartTimeframe = '1D' | '7D' | '1M';

export async function fetchChartDataByTimeframe(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) return [];
  
  const params: Record<ChartTimeframe, { days: number; interval: string }> = {
    '1D': { days: 1, interval: 'hourly' },
    '7D': { days: 7, interval: 'daily' },
    '1M': { days: 30, interval: 'daily' },
  };
  
  const { days, interval } = params[timeframe];
  
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    
    // For 1D hourly: format as "HH:mm", for others: day abbreviation
    if (timeframe === '1D') {
      return (data.prices as [number, number][]).map(([ts, price]) => ({
        date: new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        price,
      }));
    } else {
      const days2 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return (data.prices as [number, number][]).map(([ts, price]) => ({
        date: timeframe === '1M'
          ? new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
          : days2[new Date(ts).getDay()],
        price,
      }));
    }
  } catch {
    return [];
  }
}

export async function fetchChartData(symbol: string): Promise<ChartPoint[]> {
  return fetchChartDataByTimeframe(symbol, '7D');
}
