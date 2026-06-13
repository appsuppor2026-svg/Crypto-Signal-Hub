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
import { CandleCanvas } from '@/components/dashboard/CandleCanvas';
import {
  ComposedChart, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  BrainCircuit, RefreshCw, TrendingUp, TrendingDown, Minus,
  Zap, Activity, Eye, EyeOff,
} from 'lucide-react';

// ── Candle tooltip ────────────────────────────────────────────────────────────
const CandleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as OHLCPoint;
  if (!d?.open) return null;
  const g   = d.close >= d.open;
  const fmt = (v: number) => v >= 1
    ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toFixed(5)}`;
  return (
    <div className="bg-black/95 border border-border/60 rounded-lg p-2.5 text-xs font-mono shadow-xl">
      <div className="text-muted-foreground text-[10px] mb-1.5 font-sans">{label}</div>
      <div className={`space-y-0.5 ${g ? 'text-green-400' : 'text-red-400'}`}>
        <div className="grid grid-cols-2 gap-x-3">
          <span>O: {fmt(d.open)}</span><span>H: {fmt(d.high)}</span>
          <span>L: {fmt(d.low)}</span><span className="font-bold">C: {fmt(d.close)}</span>
        </div>
        <div className="text-[10px] opacity-70 pt-0.5">
          {g ? '▲' : '▼'} {Math.abs(((d.close - d.open) / d.open) * 100).toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

const TIMEFRAMES: ChartTimeframe[] = ['5M', '15M', '1H', '4H', '1D', '7D'];
const TF_LABELS: Record<string, string> = {
  '5M':'5m','15M':'15m','1H':'1h','4H':'4h','1D':'1D','7D':'7D',
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

  const [result,      setResult]      = useState<SmartAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Fetch OHLC ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setChartError(false);
    fetchOHLCData(selectedAsset, timeframe)
      .then(data => {
        if (!mounted) return;
        setOhlcData(data.length ? data : []);
        setLoading(false);
        if (!data.length) setChartError(true);
      })
      .catch(() => { if (mounted) { setLoading(false); setChartError(true); } });
    return () => { mounted = false; };
  }, [selectedAsset, timeframe]);

  // Reset on asset change
  useEffect(() => {
    setOhlcData([]);
    setResult(null);
  }, [selectedAsset]);

  // ── Indicators ─────────────────────────────────────────────────────────────
  const ind = useMemo(() => {
    if (!ohlcData.length) return { ema: [], bbU: [], bbL: [], sqz: [], rsi: null as number | null, trend: 'sideways' as 'up' | 'down' | 'sideways' };
    const prices = ohlcData.map(d => d.close);
    const emaPeriod = Math.min(50, Math.floor(prices.length * 0.7));
    const bbPeriod  = Math.min(20, prices.length);
    const emaArr = calculateEMA(prices, emaPeriod);
    const bbArr  = calculateBollingerBands(prices, bbPeriod);
    const sqzArr = calculateSqueezeMomentum(prices, bbPeriod, bbPeriod, 1.5);

    // RSI(14) — computed directly from chart data
    const rsi = (() => {
      const period = 14;
      if (prices.length < period + 1) return null;
      const slice = prices.slice(-period - 1);
      let gains = 0, losses = 0;
      for (let i = 1; i < slice.length; i++) {
        const diff = slice[i] - slice[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) return 100;
      return 100 - 100 / (1 + avgGain / avgLoss);
    })();

    // EMA-based trend
    const lastEma = emaArr.findLast(v => v != null) ?? null;
    const lastPrice = prices[prices.length - 1];
    const trend: 'up' | 'down' | 'sideways' = lastEma === null
      ? 'sideways'
      : lastPrice > lastEma * 1.002 ? 'up'
      : lastPrice < lastEma * 0.998 ? 'down'
      : 'sideways';

    return {
      ema: emaArr,
      bbU: bbArr.map(b => b.upper),
      bbL: bbArr.map(b => b.lower),
      sqz: sqzArr.map(s => s.momentum),
      rsi,
      trend,
    };
  }, [ohlcData]);

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low))  * 0.9985 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.0015 : 0;
  const fmtY    = (v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(4)}`;

  const sqzBarData = useMemo(() =>
    ohlcData.map((d, i) => ({ date: d.date, sqz: ind.sqz[i] ?? 0 })),
    [ohlcData, ind.sqz]
  );

  // ── SAE Analysis ───────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    if (!assetData || isAnalyzing) return;
    setIsAnalyzing(true);
    const prices = ohlcData.length ? ohlcData.map(d => d.close) : assetData.chartData.map(d => d.price);
    setTimeout(() => {
      setResult(runSmartAnalysis(assetData, prices));
      setIsAnalyzing(false);
    }, 700);
  };

  // ── Probability gauge ──────────────────────────────────────────────────────
  const pct24h = assetData?.changePercent24h ?? 0;
  const rawScore = result
    ? result.signal.score
    : Math.max(-80, Math.min(80,
        ((assetData?.radarScore ?? 50) - 50) * 1.2 + pct24h * 2
      ));
  const bullPct = Math.max(5, Math.min(95, Math.round((rawScore + 100) / 2)));
  const bearPct = 100 - bullPct;

  // ── Signal styling ─────────────────────────────────────────────────────────
  const isPositive  = pct24h >= 0;
  const signalColor = result?.signal.type === 'BUY'
    ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : result?.signal.type === 'SELL'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  const SignalIcon = result?.indicadores.trend === 'up' ? TrendingUp
    : result?.indicadores.trend === 'down' ? TrendingDown : Minus;

  const indRes = result?.indicadores;

  const sections = result ? [
    { icon: '📊', title: 'Situación Actual',   text: result.situacion         },
    { icon: '🔴', title: 'Resistencias Clave', text: result.resistencias      },
    { icon: '🟢', title: 'Soportes Clave',     text: result.soportes          },
    { icon: '📈', title: 'Escenario Alcista',  text: result.escenarioAlcista  },
    { icon: '📉', title: 'Escenario Bajista',  text: result.escenarioBajista  },
    { icon: '⚡', title: 'Señal de Trading',   text: result.signal.label      },
    { icon: '⚠️', title: 'Gestión de Riesgo', text: result.riesgo            },
  ] : [];

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        {/* ── Header ─────────────────────────────────────────────── */}
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
              {isPositive ? '▲' : '▼'} {Math.abs(pct24h).toFixed(2)}% 24h
            </div>
          </div>
        </div>

        {/* ── Quick stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Radar Score', val: assetData?.radarScore ?? '--', color: 'text-primary' },
            { label: 'RSI (14)',
              val: ind.rsi != null ? ind.rsi.toFixed(0) : (ohlcData.length ? '--' : '…'),
              color: ind.rsi != null ? (ind.rsi > 70 ? 'text-red-400' : ind.rsi < 30 ? 'text-green-400' : 'text-foreground') : 'text-muted-foreground' },
            { label: 'EMA Tendencia',
              val: ind.trend === 'up' ? '↑ Alcista' : ind.trend === 'down' ? '↓ Bajista' : (ohlcData.length ? '→ Lateral' : '…'),
              color: ind.trend === 'up' ? 'text-green-400' : ind.trend === 'down' ? 'text-red-400' : 'text-muted-foreground' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
              <div className={`font-bold text-sm font-mono ${color}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── Probability gauge ──────────────────────────────────── */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-violet-400" />
                Probabilidad Radar
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {result ? 'SAE score' : 'Radar score'}
              </span>
            </div>
            <div className="space-y-2">
              {([
                { icon: TrendingUp,   pct: bullPct, label: 'ALCISTA', col: 'from-green-500/80 to-green-400', textCol: 'text-green-400' },
                { icon: TrendingDown, pct: bearPct, label: 'BAJISTA', col: 'from-red-500/80 to-red-400',     textCol: 'text-red-400'   },
              ] as const).map(({ icon: Icon, pct, label, col, textCol }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${textCol}`} />
                  <div className="flex-1 h-5 bg-background rounded-full overflow-hidden border border-border/40 relative">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${col} rounded-full`}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                    {pct > 20 && (
                      <span className="absolute left-2 top-0 h-full flex items-center text-[10px] font-bold text-white/90">
                        {pct}%
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold w-12 shrink-0 ${textCol}`}>{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Chart card ────────────────────────────────────────── */}
        <Card className="bg-[#080b10] border-border/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 pb-2 border-b border-border/20 flex items-center justify-between flex-wrap gap-2">
            {/* Timeframes */}
            <div className="flex gap-0.5">
              {TIMEFRAMES.map(tf => (
                <Button key={tf} variant="ghost" size="sm" onClick={() => setTimeframe(tf)}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-all ${
                    timeframe === tf
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {TF_LABELS[tf]}
                </Button>
              ))}
            </div>
            {/* Indicator toggles */}
            <div className="flex gap-1">
              {[
                { key: 'ema', label: 'EMA(50)', active: showEMA, toggle: () => setShowEMA(v => !v), aCol: 'text-orange-400', aBg: 'bg-orange-500/15 border-orange-500/40' },
                { key: 'bb',  label: 'BB',  active: showBB,  toggle: () => setShowBB(v => !v),  aCol: 'text-blue-400',   aBg: 'bg-blue-500/15 border-blue-500/40'     },
                { key: 'sqz', label: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), aCol: 'text-purple-400', aBg: 'bg-purple-500/15 border-purple-500/40' },
              ].map(({ key, label, active, toggle, aCol, aBg }) => (
                <Button key={key} variant="outline" size="sm" onClick={toggle}
                  className={`h-7 px-2 text-[10px] font-bold gap-1 transition-all ${active ? `${aCol} ${aBg}` : 'text-muted-foreground/50 border-border/30'}`}>
                  {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            {loadingChart && (
              <div className="absolute inset-0 z-20 bg-[#080b10]/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
                  <span className="text-[10px] text-muted-foreground">Cargando {TF_LABELS[timeframe]}…</span>
                </div>
              </div>
            )}
            {chartError && !loadingChart && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
                <span className="text-muted-foreground text-sm">Sin datos disponibles</span>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => { setChartError(false); setTimeframe(tf => tf); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Reintentar
                </Button>
              </div>
            )}

            {/* Main candle chart — recharts for axes/grid/tooltip + CandleCanvas for rendering */}
            <div style={{ height: showSQZ ? 235 : 275 }} className="w-full pt-3 pr-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} dy={4}
                    interval="preserveStartEnd" />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false}
                    tickFormatter={fmtY} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    orientation="right" width={54} />
                  {/* Invisible line: gives recharts data for tooltip */}
                  <Tooltip content={<CandleTooltip />} />
                  <Line dataKey="close" stroke="transparent" dot={false}
                    legendType="none" isAnimationActive={false} />
                  {assetData?.price && (
                    <ReferenceLine y={assetData.price} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 4" />
                  )}
                  {assetData?.upperZoneLevels?.map((z, i) => (
                    <ReferenceLine key={`u${i}`} y={z.price} stroke="#ef4444" strokeDasharray="2 5" opacity={0.2} />
                  ))}
                  {assetData?.lowerZoneLevels?.map((z, i) => (
                    <ReferenceLine key={`l${i}`} y={z.price} stroke="#22c55e" strokeDasharray="2 5" opacity={0.2} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Canvas overlay — actual candles drawn here */}
              <CandleCanvas
                data={ohlcData}
                yMin={ohlcMin} yMax={ohlcMax}
                mt={8} mr={58} mb={28}
                showEMA={showEMA} ema={ind.ema}
                showBB={showBB}   bbUpper={ind.bbU} bbLower={ind.bbL}
              />
            </div>

            {/* SQZ sub-panel — standard recharts Bar */}
            {showSQZ && ohlcData.length > 0 && (
              <div style={{ height: 52 }} className="w-full pr-[58px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sqzBarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Bar dataKey="sqz" isAnimationActive={false}>
                      {sqzBarData.map((d, i) => (
                        <Cell key={i} fill={d.sqz > 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />
                      ))}
                    </Bar>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            <div className="px-3 pb-3 flex items-center gap-3 flex-wrap">
              {showEMA && <span className="flex items-center gap-1 text-[9px] text-orange-400/70"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />EMA(50)</span>}
              {showBB  && <span className="flex items-center gap-1 text-[9px] text-blue-400/70"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" style={{borderBottom:'1px dashed'}} />BB(20)</span>}
              {showSQZ && <span className="flex items-center gap-1 text-[9px] text-purple-400/70"><span className="w-2 h-2 bg-purple-400 inline-block rounded-sm" />SQZ</span>}
            </div>
          </div>
        </Card>

        {/* ── Analysis card ────────────────────────────────────── */}
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
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}
              onClick={handleAnalyze} disabled={isAnalyzing}
            >
              {isAnalyzing
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando…</>
                : <><BrainCircuit className="w-4 h-4" /> Analizar {selectedAsset}</>
              }
            </Button>

            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm ${signalColor}`}>
                    <SignalIcon className="w-4 h-4 shrink-0" />
                    <span>{result.signal.type === 'BUY' ? 'COMPRA' : result.signal.type === 'SELL' ? 'VENTA' : 'ESPERAR'}</span>
                    <span className="ml-auto font-mono text-xs opacity-80">Score {result.signal.score.toFixed(0)}/100</span>
                  </div>
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
                Pulsa para análisis técnico completo basado en EMA50, Bollinger Bands, RSI y Squeeze Momentum.
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
