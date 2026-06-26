export interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  radarScore: number;
  bias: 'superior' | 'inferior' | 'equilibrada' | 'incertidumbre';
  metrics: {
    liquidity: number;
    openInterest: number;
    funding: number;
    trend: number;
  };
  upperZone: { price: number; amount: string };
  lowerZone: { price: number; amount: string };
  upperZoneLevels: Array<{ price: number; amount: string }>;
  lowerZoneLevels: Array<{ price: number; amount: string }>;
  liquidityTarget: { price: number; distancePct: number };
  chartData: Array<{ date: string; price: number }>;
}

export interface Alert {
  id: string;
  text: string;
  textEn?: string;
  textKey?: 'nearMajorZone' | 'clusterNear' | 'supportDetected';
  textParam?: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
  timestampKey?: 'agoMin' | 'ago12min' | 'agoHour';
  asset: string;
}
