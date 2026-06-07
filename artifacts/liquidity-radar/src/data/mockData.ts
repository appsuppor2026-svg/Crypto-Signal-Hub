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
    metrics: { liquidity: 78, openInterest: 65, funding: 82, trend: 71 },
    upperZone: { price: 68500, amount: '245M' },
    lowerZone: { price: 65200, amount: '189M' },
    upperZoneLevels: [
      { price: 68500, amount: '90M' },
      { price: 69200, amount: '150M' },
      { price: 70100, amount: '245M' }
    ],
    lowerZoneLevels: [
      { price: 66000, amount: '60M' },
      { price: 65200, amount: '120M' },
      { price: 64100, amount: '189M' }
    ],
    liquidityTarget: { price: 70100, distancePct: 3.9 },
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
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3200.50,
    change24h: 45.20,
    changePercent24h: 1.4,
    radarScore: 68,
    bias: 'bullish',
    metrics: { liquidity: 72, openInterest: 60, funding: 75, trend: 65 },
    upperZone: { price: 3350, amount: '180M' },
    lowerZone: { price: 3050, amount: '145M' },
    upperZoneLevels: [
      { price: 3280, amount: '60M' },
      { price: 3350, amount: '120M' },
      { price: 3420, amount: '180M' }
    ],
    lowerZoneLevels: [
      { price: 3120, amount: '50M' },
      { price: 3050, amount: '90M' },
      { price: 2980, amount: '145M' }
    ],
    liquidityTarget: { price: 3420, distancePct: 6.8 },
    chartData: [
      { date: 'Mon', price: 3050 },
      { date: 'Tue', price: 3100 },
      { date: 'Wed', price: 3080 },
      { date: 'Thu', price: 3150 },
      { date: 'Fri', price: 3120 },
      { date: 'Sat', price: 3180 },
      { date: 'Sun', price: 3200 },
    ]
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    price: 165.20,
    change24h: 2.10,
    changePercent24h: 1.2,
    radarScore: 61,
    bias: 'neutral',
    metrics: { liquidity: 65, openInterest: 55, funding: 62, trend: 58 },
    upperZone: { price: 175, amount: '85M' },
    lowerZone: { price: 155, amount: '70M' },
    upperZoneLevels: [
      { price: 170, amount: '30M' },
      { price: 175, amount: '55M' },
      { price: 182, amount: '85M' }
    ],
    lowerZoneLevels: [
      { price: 160, amount: '25M' },
      { price: 155, amount: '45M' },
      { price: 148, amount: '70M' }
    ],
    liquidityTarget: { price: 182, distancePct: 10.1 },
    chartData: [
      { date: 'Mon', price: 158 },
      { date: 'Tue', price: 160 },
      { date: 'Wed', price: 155 },
      { date: 'Thu', price: 162 },
      { date: 'Fri', price: 168 },
      { date: 'Sat', price: 164 },
      { date: 'Sun', price: 165 },
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
    metrics: { liquidity: 55, openInterest: 40, funding: 38, trend: 35 },
    upperZone: { price: 0.62, amount: '45M' },
    lowerZone: { price: 0.55, amount: '82M' },
    upperZoneLevels: [
      { price: 0.60, amount: '15M' },
      { price: 0.62, amount: '25M' },
      { price: 0.65, amount: '45M' }
    ],
    lowerZoneLevels: [
      { price: 0.57, amount: '30M' },
      { price: 0.55, amount: '50M' },
      { price: 0.52, amount: '82M' }
    ],
    liquidityTarget: { price: 0.52, distancePct: -10.9 },
    chartData: [
      { date: 'Mon', price: 0.61 },
      { date: 'Tue', price: 0.62 },
      { date: 'Wed', price: 0.59 },
      { date: 'Thu', price: 0.60 },
      { date: 'Fri', price: 0.57 },
      { date: 'Sat', price: 0.59 },
      { date: 'Sun', price: 0.584 },
    ]
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB',
    price: 580.40,
    change24h: -5.20,
    changePercent24h: -0.8,
    radarScore: 55,
    bias: 'neutral',
    metrics: { liquidity: 60, openInterest: 45, funding: 50, trend: 52 },
    upperZone: { price: 605, amount: '65M' },
    lowerZone: { price: 555, amount: '55M' },
    upperZoneLevels: [
      { price: 595, amount: '20M' },
      { price: 605, amount: '40M' },
      { price: 615, amount: '65M' }
    ],
    lowerZoneLevels: [
      { price: 570, amount: '15M' },
      { price: 555, amount: '35M' },
      { price: 540, amount: '55M' }
    ],
    liquidityTarget: { price: 615, distancePct: 5.9 },
    chartData: [
      { date: 'Mon', price: 590 },
      { date: 'Tue', price: 595 },
      { date: 'Wed', price: 585 },
      { date: 'Thu', price: 580 },
      { date: 'Fri', price: 575 },
      { date: 'Sat', price: 582 },
      { date: 'Sun', price: 580 },
    ]
  },
  DOGE: {
    symbol: 'DOGE',
    name: 'Dogecoin',
    price: 0.385,
    change24h: -0.02,
    changePercent24h: -4.8,
    radarScore: 38,
    bias: 'bearish',
    metrics: { liquidity: 45, openInterest: 35, funding: 40, trend: 30 },
    upperZone: { price: 0.41, amount: '35M' },
    lowerZone: { price: 0.36, amount: '42M' },
    upperZoneLevels: [
      { price: 0.395, amount: '10M' },
      { price: 0.41, amount: '20M' },
      { price: 0.43, amount: '35M' }
    ],
    lowerZoneLevels: [
      { price: 0.375, amount: '15M' },
      { price: 0.36, amount: '25M' },
      { price: 0.34, amount: '42M' }
    ],
    liquidityTarget: { price: 0.34, distancePct: -11.6 },
    chartData: [
      { date: 'Mon', price: 0.42 },
      { date: 'Tue', price: 0.43 },
      { date: 'Wed', price: 0.40 },
      { date: 'Thu', price: 0.41 },
      { date: 'Fri', price: 0.39 },
      { date: 'Sat', price: 0.38 },
      { date: 'Sun', price: 0.385 },
    ]
  }
};

export const mockAlerts: Alert[] = [
  { id: '1', text: 'BTC está cerca de una zona de liquidez mayor', priority: 'high', timestamp: 'Hace 5 min', asset: 'BTC' },
  { id: '2', text: 'XRP se acerca a un clúster de liquidaciones', priority: 'medium', timestamp: 'Hace 12 min', asset: 'XRP' },
  { id: '3', text: 'Zona de soporte fuerte detectada en $65,200', priority: 'low', timestamp: 'Hace 1 hora', asset: 'BTC' },
];