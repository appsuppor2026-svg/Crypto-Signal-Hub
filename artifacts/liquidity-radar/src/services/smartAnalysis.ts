import { AssetData } from '@/types';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from './indicators';

export interface SmartSignal {
  type: 'BUY' | 'SELL' | 'WAIT';
  label: string;
  color: string;
  score: number; // -100 to +100
}

export interface SmartAnalysisResult {
  situacion: string;
  resistencias: string;
  soportes: string;
  escenarioAlcista: string;
  escenarioBajista: string;
  signal: SmartSignal;
  riesgo: string;
  indicadores: {
    ema: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
    bbWidth: number | null;
    sqzMomentum: number | null;
    inSqueeze: boolean;
    rsi: number | null;
    trend: 'up' | 'down' | 'sideways';
  };
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const slice = prices.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function fmt(v: number): string {
  return v >= 1
    ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toFixed(5)}`;
}

function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function runSmartAnalysis(asset: AssetData, prices: number[]): SmartAnalysisResult {
  const { price, change24h, upperZoneLevels, lowerZoneLevels, radarScore, bias } = asset;

  const emaArr = calculateEMA(prices, Math.min(50, prices.length));
  const bbArr = calculateBollingerBands(prices, Math.min(20, prices.length));
  const sqzArr = calculateSqueezeMomentum(prices);

  const ema = emaArr.length ? emaArr[emaArr.length - 1] : null;
  const bb = bbArr.length ? bbArr[bbArr.length - 1] : null;
  const sqz = sqzArr.length ? sqzArr[sqzArr.length - 1] : null;
  const rsi = calcRSI(prices);

  const bbUpper = bb?.upper ?? null;
  const bbMiddle = bb?.middle ?? null;
  const bbLower = bb?.lower ?? null;
  const bbWidth = (bbUpper && bbLower && bbMiddle && bbMiddle !== 0)
    ? ((bbUpper - bbLower) / bbMiddle) * 100 : null;
  const sqzMomentum = sqz?.momentum ?? null;
  const inSqueeze = sqz?.inSqueeze ?? false;

  const aboveEma = ema ? price > ema : null;
  const trend: 'up' | 'down' | 'sideways' = aboveEma === null
    ? 'sideways'
    : aboveEma ? 'up' : 'down';

  // ── Score calculation ──────────────────────────────────────────
  let score = 0;
  // EMA position
  if (ema) score += price > ema ? 20 : -20;
  // RSI
  if (rsi !== null) {
    if (rsi < 30) score += 25;       // oversold → bullish
    else if (rsi > 70) score -= 25;  // overbought → bearish
    else if (rsi < 45) score += 10;
    else if (rsi > 55) score -= 10;
  }
  // SQZ momentum
  if (sqzMomentum !== null) score += sqzMomentum > 0 ? 15 : -15;
  // 24h change
  score += Math.max(-20, Math.min(20, change24h * 2));
  // BB position
  if (bbUpper && bbLower) {
    const relPos = (price - bbLower) / (bbUpper - bbLower);
    if (relPos > 0.9) score -= 15;  // near upper band = overbought
    else if (relPos < 0.1) score += 15;
  }
  // Radar score
  score += (radarScore - 50) / 5;
  score = Math.max(-100, Math.min(100, score));

  // ── Signal ──────────────────────────────────────────────────────
  let signal: SmartSignal;
  if (score >= 30) {
    signal = { type: 'BUY', label: 'COMPRA', color: 'green', score };
  } else if (score <= -30) {
    signal = { type: 'SELL', label: 'VENTA', color: 'red', score };
  } else {
    signal = { type: 'WAIT', label: 'ESPERAR', color: 'yellow', score };
  }

  // ── Nearest zones ───────────────────────────────────────────────
  const upperZone = upperZoneLevels?.[0];
  const lowerZone = lowerZoneLevels?.[0];
  const upperDist = upperZone ? ((upperZone.price - price) / price) * 100 : null;
  const lowerDist = lowerZone ? ((price - lowerZone.price) / price) * 100 : null;

  // Entry suggestion
  const entryLong = lowerZone ? fmt(lowerZone.price * 1.005) : fmt(price * 0.99);
  const slLong = lowerZone ? fmt(lowerZone.price * 0.98) : fmt(price * 0.97);
  const tpLong = upperZone ? fmt(upperZone.price * 0.99) : fmt(price * 1.04);
  const entryShort = upperZone ? fmt(upperZone.price * 0.995) : fmt(price * 1.01);
  const slShort = upperZone ? fmt(upperZone.price * 1.02) : fmt(price * 1.03);
  const tpShort = lowerZone ? fmt(lowerZone.price * 1.01) : fmt(price * 0.96);

  // ── Texts ────────────────────────────────────────────────────────
  const trendLabel = trend === 'up' ? 'alcista' : trend === 'down' ? 'bajista' : 'lateral';
  const rsiLabel = rsi !== null
    ? (rsi > 70 ? 'sobrecomprado' : rsi < 30 ? 'sobrevendido' : 'en zona neutral')
    : 'sin datos RSI';

  const emaGap = ema ? (((price - ema) / ema) * 100).toFixed(2) : null;
  const emaText = ema
    ? `El precio se encuentra ${price > ema ? 'por encima' : 'por debajo'} de la EMA50 (${fmt(ema)}), un ${Math.abs(parseFloat(emaGap!))}% ${price > ema ? 'de ventaja' : 'de desventaja'}.`
    : '';

  const sqzText = inSqueeze
    ? 'El Squeeze Momentum indica compresión de volatilidad — se espera un movimiento brusco próximamente.'
    : sqzMomentum !== null
      ? `El Squeeze Momentum es ${sqzMomentum > 0 ? 'positivo (presión compradora)' : 'negativo (presión vendedora)'}.`
      : '';

  const bbText = bbWidth !== null
    ? `Las Bandas de Bollinger tienen una amplitud del ${bbWidth.toFixed(1)}% (${bbWidth > 5 ? 'volatilidad alta' : bbWidth > 2 ? 'volatilidad moderada' : 'volatilidad baja'}).`
    : '';

  const situacion =
    `${asset.symbol} cotiza a ${fmt(price)} con un cambio de ${fmtPct(change24h)} en 24h. ` +
    `Tendencia general: ${trendLabel}. RSI en ${rsi?.toFixed(1) ?? 'N/A'} (${rsiLabel}). ` +
    `${emaText} ${bbText} ${sqzText}`.trim();

  const resistencias = upperZoneLevels?.length
    ? `Resistencia principal en ${fmt(upperZoneLevels[0].price)} (${upperDist !== null ? fmtPct(upperDist) : 'N/A'} arriba). ` +
      (upperZoneLevels[1] ? `Segunda resistencia en ${fmt(upperZoneLevels[1].price)}.` : '') +
      (bbUpper ? ` La Banda de Bollinger superior actúa como resistencia dinámica en ${fmt(bbUpper)}.` : '')
    : 'Sin datos de resistencias disponibles.';

  const soportes = lowerZoneLevels?.length
    ? `Soporte clave en ${fmt(lowerZoneLevels[0].price)} (${lowerDist !== null ? fmtPct(lowerDist) : 'N/A'} abajo). ` +
      (lowerZoneLevels[1] ? `Soporte secundario en ${fmt(lowerZoneLevels[1].price)}.` : '') +
      (bbLower ? ` La Banda de Bollinger inferior en ${fmt(bbLower)} ofrece soporte dinámico.` : '')
    : 'Sin datos de soportes disponibles.';

  const escenarioAlcista =
    `Para activarse, ${asset.symbol} necesita superar ${upperZone ? fmt(upperZone.price) : 'resistencia inmediata'} con volumen. ` +
    `Si rompe con fuerza, el siguiente objetivo sería ${upperZoneLevels?.[1] ? fmt(upperZoneLevels[1].price) : 'zona de liquidez superior'}. ` +
    (rsi && rsi < 50 ? `El RSI aún tiene recorrido alcista sin estar sobrecomprado.` :
      rsi && rsi > 70 ? `Ojo: el RSI sobrecomprado podría limitar el alza en el corto plazo.` : '');

  const escenarioBajista =
    `Si pierde el soporte de ${lowerZone ? fmt(lowerZone.price) : 'zona de soporte'}, ` +
    `se abriría paso hacia ${lowerZoneLevels?.[1] ? fmt(lowerZoneLevels[1].price) : 'niveles inferiores'}. ` +
    (rsi && rsi > 70 ? `El RSI sobrecomprado aumenta la probabilidad de corrección.` :
      inSqueeze ? `El Squeeze pendiente podría decantar hacia abajo si falla el soporte.` : '');

  const signalDetail = signal.type === 'BUY'
    ? `Señal COMPRA (Score: ${score.toFixed(0)}/100). Zona de entrada: ${entryLong}, stop loss: ${slLong}, objetivo: ${tpLong}.`
    : signal.type === 'SELL'
      ? `Señal VENTA/SHORT (Score: ${score.toFixed(0)}/100). Entrada short: ${entryShort}, stop loss: ${slShort}, objetivo: ${tpShort}.`
      : `Señal ESPERAR (Score: ${score.toFixed(0)}/100). El mercado no presenta una dirección clara. Aguarda ruptura de ${upperZone ? fmt(upperZone.price) : 'resistencia'} o pérdida de ${lowerZone ? fmt(lowerZone.price) : 'soporte'}.`;

  const riesgo =
    `Opera siempre con stop loss. No arriesgues más del 1-2% de tu capital por operación. ` +
    (inSqueeze ? `El Squeeze activo implica potencial de movimiento brusco — reduce el tamaño de posición. ` : '') +
    `Este análisis es orientativo y no constituye asesoramiento financiero.`;

  return {
    situacion,
    resistencias,
    soportes,
    escenarioAlcista,
    escenarioBajista,
    signal: { ...signal, label: signalDetail },
    riesgo,
    indicadores: {
      ema, bbUpper, bbMiddle, bbLower, bbWidth,
      sqzMomentum, inSqueeze, rsi, trend,
    },
  };
}
