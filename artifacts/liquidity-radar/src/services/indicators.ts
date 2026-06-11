export interface ChartPoint { date: string; price: number; }

export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(period - 1).fill(null);
  
  if (prices.length < period) return prices.map(() => null);
  
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(firstSMA);
  
  for (let i = period; i < prices.length; i++) {
    result.push(prices[i] * k + result[result.length - 1]! * (1 - k));
  }
  return result;
}

export interface BollingerPoint { upper: number | null; middle: number | null; lower: number | null; }
export function calculateBollingerBands(prices: number[], period = 20, stdMultiplier = 2): BollingerPoint[] {
  return prices.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + stdMultiplier * std, middle: mean, lower: mean - stdMultiplier * std };
  });
}

export interface SqzPoint { momentum: number | null; inSqueeze: boolean; }
export function calculateSqueezeMomentum(prices: number[], bbPeriod = 20, kcPeriod = 20, kcMult = 1.5): SqzPoint[] {
  const bb = calculateBollingerBands(prices, bbPeriod);
  const kc = prices.map((_, i) => {
    if (i < kcPeriod - 1) return { upper: null, lower: null };
    const slice = prices.slice(i - kcPeriod + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / kcPeriod;
    const ranges = slice.map((p, j) => j === 0 ? 0 : Math.abs(p - slice[j-1]));
    const atr = ranges.reduce((a, b) => a + b) / kcPeriod;
    return { upper: mean + kcMult * atr, lower: mean - kcMult * atr };
  });

  const momPeriod = 20;
  return prices.map((price, i) => {
    if (i < momPeriod - 1) return { momentum: null, inSqueeze: false };
    const slice = prices.slice(i - momPeriod + 1, i + 1);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    const midHL = (highest + lowest) / 2;
    const bbItem = bb[i];
    const kcItem = kc[i];
    const inSqueeze = bbItem.upper !== null && kcItem.upper !== null &&
      bbItem.upper < kcItem.upper! && bbItem.lower! > kcItem.lower!;
    return { momentum: price - midHL, inSqueeze };
  });
}
