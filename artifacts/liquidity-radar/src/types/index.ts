export interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  radarScore: number;
  bias: 'bullish' | 'neutral' | 'bearish';
  metrics: {
    liquidity: number;
    openInterest: number;
    funding: number;
    trend: number;
  };
  upperZone: { price: number; amount: string };
  lowerZone: { price: number; amount: string };
  chartData: Array<{ date: string; price: number }>;
}

export interface Alert {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
  asset: string;
}
