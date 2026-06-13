import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsset } from '@/context/AssetContext';
import { useAssetData } from '@/hooks/useAssetData';
import { runSmartAnalysis, SmartAnalysisResult } from '@/services/smartAnalysis';
import { fetchOHLCData, OHLCPoint, ChartTimeframe } from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';
import {
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, BarChart, Bar, Cell, Customized,
} from 'recharts';
import {
  BrainCircuit, RefreshCw, TrendingUp, TrendingDown, Minus,
  Zap, Activity, Eye, EyeOff,
} from 'lucide-react';

// ── Candle renderer ──────────────────────────────────────────────────────────
const CandleSticks = ({ xAxisMap, yAxisMap, data }: any) => {
  if (!xAxisMap || !yAxisMap || !data?.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const bandwidth: number = (() => {
    if (typeof xScale.bandwidth === 'function') return xScale.bandwidth();
    const range = xScale.range?.() as [number, number] | undefined;
    if (range && data.length > 1) return (range[1] - range[0]) / data.length;
    return 8;
  })();
  return (
    <g>
      {(data as OHLCPoint[]).map((p, i) => {
        const x0 = xScale(p.date);
        if (x0 == null) return null;
        const cx = x0 + bandwidth / 2;
        const w = Math.max(bandwidth * 0.65, 1.5);
        const openY  = yScale(p.open);  const closeY = yScale(p.close);
        const highY  = yScale(p.high);  const lowY   = yScale(p.low);
        const isGreen = p.close >= p.open;
        const color   = isGreen ? '#22c55e' : '#ef4444';
        return (
          <g key={i}>
            <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} opacity={0.9} />
            <rect x={cx - w / 2} y={Math.min(openY, closeY)} width={w}
              height={Math.max(Math.abs(closeY - openY), 1.5)}
              fill={color} stroke={isGreen ? '#16a34a' : '#dc2626'} strokeWidth={0.5} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

// ── Indicator overlay on candles ─────────────────────────────────────────────
interface EnrichedOHLC extends OHLCPoint {
  ema:    number | null;
  bbU:    number | null;
  bbL:    number | null;
  sqzMom: number | null;
}

const TIMEFRAMES: ChartTimeframe[] = ['5M', '15M', '1H', '4H', '1D', '7D'];
const TF_LABELS: Record<string, string> = {
  '5M': '5m', '15M': '15m', '1H': '1h', '4H': '4h', '1D': '1D', '7D': '7D',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAnalysis() {
  const { selectedAsset } = useAsset();
  const { assetData }     = useAssetData(selectedAsset);

  const [timeframe, setTimeframe]   = useState<ChartTimeframe>('1H');
  const [ohlcData, setOhlcData]     = useState<OHLCPoint[]>([]);
  const [loadingChart, setLoading]  = useState(false);
  const [chartError, setChartError] = useState(false);

  const [showEMA, setShowEMA] = useState(true);
  const [showBB,  setShowBB]  = useState(true);
  const [showSQZ, setShowSQZ] = useState(false);

  const [result,       setResult]       = useState<SmartAnalysisResult | null>(null);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);

  // ── Fetch OHLC ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setChartError(false);
    fetchOHLCData(selectedAsset, timeframe)
      .then(data => {
        if (!mounted) return;
        setOhlcData(data);
        setLoading(false);
        if (!data.length) setChartError(true);
      })
      .catch(() => { if (mounted) { setLoading(false); setChartError(true); } });
    return () => { mounted = false; };
  }, [selectedAsset, timeframe]);

  // ── Enrich OHLC with indicators ────────────────────────────────────────────
  const enriched: EnrichedOHLC[] = useMemo(() => {
    if (!ohlcData.length) return [];
    const prices = ohlcData.map(d => d.close);
    const emaArr = calculateEMA(prices, Math.min(50, prices.length));
    const bbArr  = calculateBollingerBands(prices, Math.min(20, prices.length));
    const sqzArr = showSQZ ? calculateSqueezeMomentum(prices) : [];
    return ohlcData.map((d, i) => ({
      ...d,
      ema:    emaArr[i] ?? null,
      bbU:    bbArr[i]?.upper ?? null,
      bbL:    bbArr[i]?.lower ?? null,
      sqzMom: showSQZ ? (sqzArr[i]?.momentum ?? null) : null,
    }));
  }, [ohlcData, showSQZ]);

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low))  * 0.9985 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.0015 : 0;
  const fmtY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(4)}`;

  // ── Analysis ───────────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    if (!assetData || isAnalyzing) return;
    setIsAnalyzing(true);
    const prices = enriched.length ? enriched.map(d => d.close) : assetData.chartData.map(d => d.price);
    setTimeout(() => {
      setResult(runSmartAnalysis(assetData, prices));
      setIsAnalyzing(false);
    }, 700);
  };

  // ── Probability gauge ──────────────────────────────────────────────────────
  const rawScore = result
    ? result.signal.score
    : Math.max(-80, Math.min(80,
        ((assetData?.radarScore ?? 50) - 50) * 1.2 + (assetData?.change24h ?? 0) * 2
      ));
  const bullPct = Math.max(5, Math.min(95, Math.round((rawScore + 100) / 2)));
  const bearPct = 100 - bullPct;

  // ── Signal styling ─────────────────────────────────────────────────────────
  const isPositive  = (assetData?.change24h ?? 0) >= 0;
  const signalColor = result?.signal.type === 'BUY'
    ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : result?.signal.type === 'SELL'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  const SignalIcon = result?.indicadores.trend === 'up' ? TrendingUp
    : result?.indicadores.trend === 'down' ? TrendingDown : Minus;

  const ind = result?.indicadores;

  const sections = result ? [
    { icon: '📊', title: 'Situación Actual',    text: result.situacion },
    { icon: '🔴', title: 'Resistencias Clave',  text: result.resistencias },
    { icon: '🟢', title: 'Soportes Clave',      text: result.soportes },
    { icon: '📈', title: 'Escenario Alcista',   text: result.escenarioAlcista },
    { icon: '📉', title: 'Escenario Bajista',   text: result.escenarioBajista },
    { icon: '⚡', title: 'Señal de Trading',    text: result.signal.label },
    { icon: '⚠️', title: 'Gestión de Riesgo',  text: result.riesgo },
  ] : [];

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shadow-[0_0_14px_0_rgba(139,92,246,0.3)]">
              <BrainCircuit className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-1.5">
                Smart Analysis
                <Badge className="text-[9px] bg-violet-500/15 text-violet-300 border-violet-500/30 font-mono">SAE v1</Badge>
              </h1>
              <p className="text-[10px] text-muted-foreground">Engine · 100% algorítmico</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold tracking-tight ${isPositive ? 'text-green-400' : 'text-red-400'}`}
              style={{ textShadow: isPositive ? '0 0 20px rgba(34,197,94,0.4)' : '0 0 20px rgba(239,68,68,0.4)' }}>
              ${(assetData?.price ?? 0).toLocaleString('es-ES', {
                minimumFractionDigits: assetData?.price && assetData.price < 1 ? 4 : 2,
                maximumFractionDigits: assetData?.price && assetData.price < 1 ? 4 : 2,
              })}
            </div>
            <div className={`text-xs font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(assetData?.change24h ?? 0).toFixed(2)}% 24h
            </div>
          </div>
        </div>

        {/* ── Quick stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Radar Score', val: assetData?.radarScore ?? '--', color: 'text-primary' },
            { label: 'RSI (14)',    val: ind?.rsi ? ind.rsi.toFixed(0) : '--',
              color: ind?.rsi ? (ind.rsi > 70 ? 'text-red-400' : ind.rsi < 30 ? 'text-green-400' : 'text-foreground') : 'text-foreground' },
            { label: 'Tendencia',  val: ind?.trend === 'up' ? '↑ Alcista' : ind?.trend === 'down' ? '↓ Bajista' : '→ Lateral',
              color: ind?.trend === 'up' ? 'text-green-400' : ind?.trend === 'down' ? 'text-red-400' : 'text-muted-foreground' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
              <div className={`font-bold text-sm font-mono ${color}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── Probability gauge ─────────────────────────────────────────── */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-violet-400" />
                Probabilidad Direccional
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {result ? 'SAE score' : 'Indicativo'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <div className="flex-1 h-5 bg-background rounded-full overflow-hidden border border-border/40 relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500/80 to-green-400 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${bullPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  {bullPct > 20 && (
                    <span className="absolute left-2 top-0 h-full flex items-center text-[10px] font-bold text-white/90">
                      {bullPct}%
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-green-400 w-12 shrink-0">ALCISTA</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <div className="flex-1 h-5 bg-background rounded-full overflow-hidden border border-border/40 relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500/80 to-red-400 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${bearPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                  {bearPct > 20 && (
                    <span className="absolute left-2 top-0 h-full flex items-center text-[10px] font-bold text-white/90">
                      {bearPct}%
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-red-400 w-12 shrink-0">BAJISTA</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Chart card ────────────────────────────────────────────────── */}
        <Card className="bg-[#080b10] border-border/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 pb-2 border-b border-border/20 flex items-center justify-between flex-wrap gap-2">
            {/* Timeframes */}
            <div className="flex gap-0.5">
              {TIMEFRAMES.map(tf => (
                <Button key={tf} variant="ghost" size="sm" onClick={() => setTimeframe(tf)}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-all ${
                    timeframe === tf
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold shadow-[0_0_8px_0_rgba(139,92,246,0.2)]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {TF_LABELS[tf]}
                </Button>
              ))}
            </div>
            {/* Indicator toggles */}
            <div className="flex gap-1">
              {[
                { key: 'ema', label: 'EMA', active: showEMA, toggle: () => setShowEMA(v => !v), color: 'text-orange-400', activeBg: 'bg-orange-500/15 border-orange-500/40' },
                { key: 'bb',  label: 'BB',  active: showBB,  toggle: () => setShowBB(v => !v),  color: 'text-blue-400',   activeBg: 'bg-blue-500/15 border-blue-500/40'   },
                { key: 'sqz', label: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), color: 'text-purple-400', activeBg: 'bg-purple-500/15 border-purple-500/40' },
              ].map(({ key, label, active, toggle, color, activeBg }) => (
                <Button key={key} variant="outline" size="sm" onClick={toggle}
                  className={`h-7 px-2 text-[10px] font-bold gap-1 transition-all ${
                    active ? `${color} ${activeBg}` : 'text-muted-foreground/50 border-border/30'
                  }`}>
                  {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            {loadingChart && (
              <div className="absolute inset-0 z-10 bg-[#080b10]/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
                  <span className="text-[10px] text-muted-foreground">Cargando {TF_LABELS[timeframe]}...</span>
                </div>
              </div>
            )}

            {chartError && !loadingChart && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <span className="text-muted-foreground text-sm">Sin datos disponibles</span>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => { setChartError(false); setTimeframe(tf => tf); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Reintentar
                </Button>
              </div>
            )}

            <div style={{ height: showSQZ ? 235 : 275 }} className="w-full pt-3 pr-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={enriched} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emaGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#fb923c" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} dy={4} interval="preserveStartEnd" />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false}
                    tickFormatter={fmtY} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    orientation="right" width={50} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as EnrichedOHLC;
                    if (!d?.open) return null;
                    const isG = d.close >= d.open;
                    const f   = (v: number) => v >= 1 ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${v.toFixed(5)}`;
                    const pct = ((d.close - d.open) / d.open * 100).toFixed(2);
                    return (
                      <div className="bg-black/95 border border-border/60 rounded-lg p-2.5 text-xs font-mono shadow-xl">
                        <div className="text-muted-foreground text-[10px] mb-1.5 font-sans">{label}</div>
                        <div className={`space-y-0.5 ${isG ? 'text-green-400' : 'text-red-400'}`}>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>O: {f(d.open)}</span><span>H: {f(d.high)}</span>
                            <span>L: {f(d.low)}</span><span className="font-bold">C: {f(d.close)}</span>
                          </div>
                          <div className="text-[10px] opacity-70 pt-0.5">{isG ? '▲' : '▼'} {Math.abs(parseFloat(pct))}%</div>
                        </div>
                        {showEMA && d.ema && <div className="text-orange-400 text-[10px] pt-1">EMA50: {f(d.ema)}</div>}
                        {showBB  && d.bbU && <div className="text-blue-400 text-[10px]">BB: {f(d.bbL ?? 0)} – {f(d.bbU)}</div>}
                      </div>
                    );
                  }} />

                  {/* Current price line */}
                  {assetData?.price && (
                    <ReferenceLine y={assetData.price} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 4" />
                  )}

                  {/* Liquidity zones */}
                  {assetData?.upperZoneLevels?.map((z, i) => (
                    <ReferenceLine key={`u${i}`} y={z.price} stroke="#ef4444" strokeDasharray="2 5" opacity={0.2} />
                  ))}
                  {assetData?.lowerZoneLevels?.map((z, i) => (
                    <ReferenceLine key={`l${i}`} y={z.price} stroke="#22c55e" strokeDasharray="2 5" opacity={0.2} />
                  ))}

                  {/* EMA50 */}
                  {showEMA && (
                    <Line dataKey="ema" type="monotone" stroke="url(#emaGrad)" strokeWidth={1.5}
                      dot={false} isAnimationActive={false} connectNulls />
                  )}
                  {/* BB bands */}
                  {showBB && <>
                    <Line dataKey="bbU" type="monotone" stroke="#3b82f6" strokeWidth={1}
                      strokeDasharray="3 3" opacity={0.55} dot={false} isAnimationActive={false} connectNulls />
                    <Line dataKey="bbL" type="monotone" stroke="#3b82f6" strokeWidth={1}
                      strokeDasharray="3 3" opacity={0.55} dot={false} isAnimationActive={false} connectNulls />
                  </>}

                  {/* Transparent line needed for recharts scale */}
                  <Line dataKey="close" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />

                  {/* Candles drawn LAST (on top of indicators) */}
                  <Customized component={(props: any) => <CandleSticks {...props} data={enriched} />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* SQZ sub-panel */}
            {showSQZ && (
              <div className="w-full h-[50px] pb-2 pr-12">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enriched} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Bar dataKey="sqzMom">
                      {enriched.map((e, i) => <Cell key={i} fill={(e.sqzMom || 0) > 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />)}
                    </Bar>
                    <XAxis dataKey="date" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            <div className="px-3 pb-3 flex items-center gap-3 flex-wrap">
              {showEMA && <span className="flex items-center gap-1 text-[9px] text-orange-400/70"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />EMA50</span>}
              {showBB  && <span className="flex items-center gap-1 text-[9px] text-blue-400/70"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded border-b border-dashed" />BB(20)</span>}
              {showSQZ && <span className="flex items-center gap-1 text-[9px] text-purple-400/70"><span className="w-2 h-2 bg-purple-400 inline-block rounded-sm" />SQZ</span>}
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30 ml-auto">
                Zonas: <span className="text-red-400/40">— sup</span> <span className="text-green-400/40">— inf</span>
              </span>
            </div>
          </div>
        </Card>

        {/* ── Indicator values bar ──────────────────────────────────────── */}
        {ind && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'EMA50',    val: ind.ema ? (ind.ema >= 1000 ? `$${(ind.ema/1000).toFixed(2)}k` : `$${ind.ema.toFixed(2)}`) : '--', dot: ind.ema ? (assetData?.price ?? 0) > ind.ema ? '🟢' : '🔴' : '' },
              { label: 'BB Width', val: ind.bbWidth ? `${ind.bbWidth.toFixed(1)}%` : '--', dot: ind.bbWidth ? (ind.bbWidth > 5 ? '🔴' : ind.bbWidth < 2 ? '🔵' : '🟡') : '' },
              { label: 'SQZ',      val: ind.inSqueeze ? 'En squeeze' : ind.sqzMomentum !== null ? (ind.sqzMomentum > 0 ? 'Positivo' : 'Negativo') : '--', dot: ind.inSqueeze ? '🔵' : ind.sqzMomentum !== null ? (ind.sqzMomentum > 0 ? '🟢' : '🔴') : '' },
              { label: 'RSI (14)', val: ind.rsi ? ind.rsi.toFixed(1) : '--', dot: ind.rsi ? (ind.rsi > 70 ? '🔴' : ind.rsi < 30 ? '🟢' : '🟡') : '' },
            ].map(({ label, val, dot }) => (
              <div key={label} className="bg-card border border-border/50 rounded-xl p-2.5 flex justify-between items-center">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium text-right">{dot} {val}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Analysis card ──────────────────────────────────────────────── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              Smart Analysis Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Button
              className="w-full h-11 font-bold gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando...</>
              ) : (
                <><BrainCircuit className="w-4 h-4" /> Analizar {selectedAsset}</>
              )}
            </Button>

            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* Signal badge */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm ${signalColor}`}>
                    <SignalIcon className="w-4 h-4 shrink-0" />
                    <span>{result.signal.type === 'BUY' ? 'COMPRA' : result.signal.type === 'SELL' ? 'VENTA' : 'ESPERAR'}</span>
                    <span className="ml-auto font-mono text-xs opacity-80">Score {result.signal.score.toFixed(0)}/100</span>
                  </div>

                  {/* Analysis sections */}
                  <div className="space-y-3">
                    {sections.map(({ icon, title, text }) => (
                      <div key={title} className="space-y-1">
                        <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>{icon}</span> {title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-5">{text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!result && !isAnalyzing && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Pulsa el botón para generar un análisis técnico completo basado en EMA50, Bollinger Bands, RSI y Squeeze Momentum. Sin coste de API.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground/40 text-center">
          Análisis algorítmico · No es asesoramiento financiero
        </p>
      </motion.div>
    </div>
  );
}
