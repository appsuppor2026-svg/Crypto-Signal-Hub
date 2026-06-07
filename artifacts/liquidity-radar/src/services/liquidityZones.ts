import { AssetData } from '@/types';

interface ZoneConfig {
  upperPct: number;
  lowerPct: number;
  upperAmountBase: string;
  lowerAmountBase: string;
}

const ZONE_CONFIG: Record<string, ZoneConfig> = {
  BTC: { upperPct: 0.045, lowerPct: 0.042, upperAmountBase: '245M', lowerAmountBase: '189M' },
  XRP: { upperPct: 0.06,  lowerPct: 0.055, upperAmountBase: '52M',  lowerAmountBase: '78M'  },
};

const DEFAULT_CONFIG: ZoneConfig = {
  upperPct: 0.05, lowerPct: 0.05, upperAmountBase: '30M', lowerAmountBase: '30M',
};

export function computeZones(
  symbol: string,
  price: number
): Pick<AssetData, 'upperZone' | 'lowerZone'> {
  const cfg = ZONE_CONFIG[symbol] ?? DEFAULT_CONFIG;

  const upperPrice = price * (1 + cfg.upperPct);
  const lowerPrice = price * (1 - cfg.lowerPct);

  const fmt = (p: number) =>
    p >= 1000
      ? parseFloat(p.toFixed(0))
      : p >= 1
      ? parseFloat(p.toFixed(3))
      : parseFloat(p.toFixed(5));

  return {
    upperZone: { price: fmt(upperPrice), amount: cfg.upperAmountBase },
    lowerZone: { price: fmt(lowerPrice), amount: cfg.lowerAmountBase },
  };
}
