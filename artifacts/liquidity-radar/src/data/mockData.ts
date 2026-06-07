import { AssetData, Alert } from '../types';

export const mockAssets: Record<string, AssetData> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67432.50,
    change24h: 1543.20,
    changePercent24h: 2.34,
    radarScore: 73,
    bias: 'bullish',
    metrics: {
      liquidity: 78,
      openInterest: 65,
      funding: 82,
      trend: 71,
    },
    upperZone: { price: 68500, amount: '245M' },
    lowerZone: { price: 65200, amount: '189M' },
    chartData: [
      { date: 'Mon', price: 64100 },
      { date: 'Tue', price: 63800 },
      { date: 'Wed', price: 65200 },
      { date: 'Thu', price: 64900 },
      { date: 'Fri', price: 66100 },
      { date: 'Sat', price: 66800 },
      { date: 'Sun', price: 67432 },
    ]
  },
  XRP: {
    symbol: 'XRP',
    name: 'XRP',
    price: 0.584,
    change24h: -0.012,
    changePercent24h: -2.01,
    radarScore: 42,
    bias: 'bearish',
    metrics: {
      liquidity: 55,
      openInterest: 40,
      funding: 38,
      trend: 35,
    },
    upperZone: { price: 0.62, amount: '45M' },
    lowerZone: { price: 0.55, amount: '82M' },
    chartData: [
      { date: 'Mon', price: 0.61 },
      { date: 'Tue', price: 0.62 },
      { date: 'Wed', price: 0.59 },
      { date: 'Thu', price: 0.60 },
      { date: 'Fri', price: 0.57 },
      { date: 'Sat', price: 0.59 },
      { date: 'Sun', price: 0.584 },
    ]
  }
};

export const mockAlerts: Alert[] = [
  { id: '1', text: 'BTC está cerca de una zona de liquidez mayor', priority: 'high', timestamp: 'Hace 5 min', asset: 'BTC' },
  { id: '2', text: 'XRP se acerca a un clúster de liquidaciones', priority: 'medium', timestamp: 'Hace 12 min', asset: 'XRP' },
  { id: '3', text: 'Zona de soporte fuerte detectada en $65,200', priority: 'low', timestamp: 'Hace 1 hora', asset: 'BTC' },
];
