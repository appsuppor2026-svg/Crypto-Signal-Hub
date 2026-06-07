import { AssetData } from '@/types';

interface ZoneConfig {
  upperPct: number;
  lowerPct: number;
  upperAmountBase: string;
  lowerAmountBase: string;
}

const ZONE_CONFIG: Record<string, ZoneConfig> = {
  BTC: { upperPct: 0.045, lowerPct: 0.042, upperAmountBase: '245M', lowerAmountBase: '189M' },
  ETH: { upperPct: 0.042, lowerPct: 0.040, upperAmountBase: '180M', lowerAmountBase: '145M' },
  SOL: { upperPct: 0.055, lowerPct: 0.050, upperAmountBase: '85M', lowerAmountBase: '70M' },
  XRP: { upperPct: 0.06,  lowerPct: 0.055, upperAmountBase: '52M',  lowerAmountBase: '78M'  },
  BNB: { upperPct: 0.045, lowerPct: 0.042, upperAmountBase: '65M',  lowerAmountBase: '55M'  },
  DOGE: { upperPct: 0.065, lowerPct: 0.060, upperAmountBase: '35M',  lowerAmountBase: '42M'  },
};

const DEFAULT_CONFIG: ZoneConfig = {
  upperPct: 0.05, lowerPct: 0.05, upperAmountBase: '30M', lowerAmountBase: '30M',
};

export function computeZones(
  symbol: string,
  price: number
): Pick<AssetData, 'upperZone' | 'lowerZone' | 'upperZoneLevels' | 'lowerZoneLevels' | 'liquidityTarget'> {
  const cfg = ZONE_CONFIG[symbol] ?? DEFAULT_CONFIG;

  const fmt = (p: number) =>
    p >= 1000
      ? parseFloat(p.toFixed(0))
      : p >= 1
      ? parseFloat(p.toFixed(3))
      : parseFloat(p.toFixed(5));

  const upperPrice = price * (1 + cfg.upperPct);
  const lowerPrice = price * (1 - cfg.lowerPct);

  // Parse base amounts
  const upperBaseNum = parseInt(cfg.upperAmountBase);
  const lowerBaseNum = parseInt(cfg.lowerAmountBase);

  const upperZoneLevels = [
    { price: fmt(price * 1.04), amount: `${Math.floor(upperBaseNum * 0.4)}M` },
    { price: fmt(price * 1.055), amount: `${Math.floor(upperBaseNum * 0.8)}M` },
    { price: fmt(price * 1.07), amount: `${upperBaseNum}M` },
  ];

  const lowerZoneLevels = [
    { price: fmt(price * 0.96), amount: `${Math.floor(lowerBaseNum * 0.4)}M` },
    { price: fmt(price * 0.945), amount: `${Math.floor(lowerBaseNum * 0.8)}M` },
    { price: fmt(price * 0.93), amount: `${lowerBaseNum}M` },
  ];

  // Pick target as highest from upper
  const targetLevel = upperZoneLevels[2];
  const distancePct = ((targetLevel.price - price) / price) * 100;

  return {
    upperZone: { price: fmt(upperPrice), amount: cfg.upperAmountBase },
    lowerZone: { price: fmt(lowerPrice), amount: cfg.lowerAmountBase },
    upperZoneLevels,
    lowerZoneLevels,
    liquidityTarget: {
      price: targetLevel.price,
      distancePct
    }
  };
}
