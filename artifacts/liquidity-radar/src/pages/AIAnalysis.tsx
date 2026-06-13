import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsset } from '@/context/AssetContext';
import { useAssetData } from '@/hooks/useAssetData';
import { runSmartAnalysis, SmartAnalysisResult } from '@/services/smartAnalysis';
import { fetchOHLCData, fetchChartDataByTimeframe, OHLCPoint, ChartPoint, ChartTimeframe } from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';
import {
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, BarChart, Bar, Cell, Customized,
} from 'recharts';
import { Cpu, RefreshCw, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

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
        const openY = yScale(p.open), closeY = yScale(p.close);
        const highY = yScale(p.high), lowY = yScale(p.low);
        const isGreen = p.close >= p.open;
        const color = isGreen ? '#22c55e' : '#ef4444';
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

const TIMEFRAMES: ChartTimeframe[] = ['1H', '4H', '1D', '7D'];
const TF_LABELS: Record<string, string> = { '1H': '1h', '4H': '4h', '1D': '1D', '7D': '7D' };

export default function AIAnalysis() {
  const { selectedAsset } = useAsset();
  const { assetData } = useAssetData(selectedAsset);

  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1H');
  const [ohlcData, setOhlcData] = useState<OHLCPoint[]>([]);
  const [lineData, setLineData] = useState<ChartPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [showSQZ, setShowSQZ] = useState(false);

  const [result, setResult] = useState<SmartAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingChart(true);
    Promise.all([
      fetchOHLCData(selectedAsset, timeframe),
      fetchChartDataByTimeframe(selectedAsset, timeframe),
    ]).then(([ohlc, line]) => {
      if (!mounted) return;
      if (ohlc.length) setOhlcData(ohlc);
      if (line.length) setLineData(line);
      setLoadingChart(false);
    });
    return () => { mounted = false; };
  }, [selectedAsset, timeframe]);

  // Indicators on line data
  const enrichedLine = (() => {
    if (!lineData.length) return [];
    const prices = lineData.map(d => d.price);
    const bb = calculateBollingerBands(prices, Math.min(20, prices.length));
    const ema = calculateEMA(prices, Math.min(50, prices.length));
    const sqz = showSQZ ? calculateSqueezeMomentum(prices) : [];
    return lineData.map((pt, i) => ({
      ...pt,
      ema: ema[i] ?? null,
      bbUpper: bb[i]?.upper ?? null,
      bbLower: bb[i]?.lower ?? null,
      sqzMomentum: showSQZ ? (sqz[i]?.momentum ?? null) : undefined,
    }));
  })();

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low)) * 0.998 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;
  const fmtY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  const handleAnalyze = () => {
    if (!assetData || isAnalyzing) return;
    setIsAnalyzing(true);
    const prices = lineData.map(d => d.price);
    if (prices.length < 5) {
      setTimeout(() => {
        setResult(runSmartAnalysis(assetData, assetData.chartData.map(d => d.price)));
        setIsAnalyzing(false);
      }, 600);
    } else {
      setTimeout(() => {
        setResult(runSmartAnalysis(assetData, prices));
        setIsAnalyzing(false);
      }, 800);
    }
  };

  const isPositive = (assetData?.change24h ?? 0) >= 0;
  const ind = result?.indicadores;

  const SignalIcon = result?.indicadores.trend === 'up' ? TrendingUp
    : result?.indicadores.trend === 'down' ? TrendingDown : Minus;

  const signalColor = result?.signal.type === 'BUY'
    ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : result?.signal.type === 'SELL'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  const sections = result ? [
    { icon: '📊', title: 'Situación Actual', text: result.situacion },
    { icon: '🔴', title: 'Resistencias Clave', text: result.resistencias },
    { icon: '🟢', title: 'Soportes Clave', text: result.soportes },
    { icon: '📈', title: 'Escenario Alcista', text: result.escenarioAlcista },
    { icon: '📉', title: 'Escenario Bajista', text: result.escenarioBajista },
    { icon: '⚡', title: 'Señal de Trading', text: result.signal.label },
    { icon: '⚠️', title: 'Gestión de Riesgo', text: result.riesgo },
  ] : [];

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Smart Analysis</h1>
              <p className="text-[10px] text-muted-foreground">Engine · 100% algorítmico</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">
              ${(assetData?.price ?? 0).toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: assetData?.price && assetData.price < 1 ? 4 : 2,
              })}
            </div>
            <div className={`text-xs font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(assetData?.change24h ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Radar Score', val: assetData?.radarScore ?? '--', color: 'text-primary' },
            { label: 'RSI', val: ind?.rsi ? ind.rsi.toFixed(0) : '--', color: ind?.rsi ? (ind.rsi > 70 ? 'text-red-400' : ind.rsi < 30 ? 'text-green-400' : 'text-foreground') : 'text-foreground' },
            { label: 'Tendencia', val: ind?.trend === 'up' ? '↑ Alcista' : ind?.trend === 'down' ? '↓ Bajista' : '→ Lateral', color: ind?.trend === 'up' ? 'text-green-400' : ind?.trend === 'down' ? 'text-red-400' : 'text-muted-foreground' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
              <div className={`font-bold text-sm font-mono ${color}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden">
          <div className="p-3 pb-2 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-0.5">
              {TIMEFRAMES.map(tf => (
                <Button key={tf} variant="ghost" size="sm" onClick={() => setTimeframe(tf)}
                  className={`h-6 px-2 text-[10px] ${timeframe === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                  {TF_LABELS[tf]}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowSQZ(v => !v)}
              className={`h-6 px-2 text-[10px] ${showSQZ ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'text-muted-foreground border-border/40'}`}>
              SQZ
            </Button>
          </div>

          <div className="relative">
            {loadingChart && (
              <div className="absolute inset-0 z-10 bg-background/60 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            )}
            <div style={{ height: showSQZ ? 245 : 285 }} className="w-full pt-3 pr-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4} interval="preserveStartEnd" />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false} tickFormatter={fmtY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} orientation="right" width={46} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as OHLCPoint;
                    if (!d?.open) return null;
                    const isG = d.close >= d.open;
                    const f = (v: number) => v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(5)}`;
                    return (
                      <div className="bg-black border border-border rounded-lg p-2 text-xs font-mono">
                        <div className="text-muted-foreground text-[10px] mb-1">{label}</div>
                        <div className={`space-y-0.5 ${isG ? 'text-green-400' : 'text-red-400'}`}>
                          <div>O: {f(d.open)}</div><div>H: {f(d.high)}</div>
                          <div>L: {f(d.low)}</div><div className="font-bold">C: {f(d.close)}</div>
                        </div>
                      </div>
                    );
                  }} />
                  {assetData?.price && <ReferenceLine y={assetData.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.35} />}
                  {assetData?.upperZoneLevels?.map((z, i) => <ReferenceLine key={`u${i}`} y={z.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.25} />)}
                  {assetData?.lowerZoneLevels?.map((z, i) => <ReferenceLine key={`l${i}`} y={z.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.25} />)}
                  {/* EMA overlay on candles */}
                  {enrichedLine.length > 0 && (() => {
                    const emaMap = new Map(enrichedLine.map(d => [d.date, d.ema]));
                    return <Line data={ohlcData.map(d => ({ ...d, ema: emaMap.get(d.date) ?? null }))}
                      type="monotone" dataKey="ema" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />;
                  })()}
                  {enrichedLine.length > 0 && (() => {
                    const buMap = new Map(enrichedLine.map(d => [d.date, d.bbUpper]));
                    const blMap = new Map(enrichedLine.map(d => [d.date, d.bbLower]));
                    const eo = ohlcData.map(d => ({ ...d, bbU: buMap.get(d.date) ?? null, bbL: blMap.get(d.date) ?? null }));
                    return <>
                      <Line data={eo} type="monotone" dataKey="bbU" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} dot={false} isAnimationActive={false} connectNulls />
                      <Line data={eo} type="monotone" dataKey="bbL" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} dot={false} isAnimationActive={false} connectNulls />
                    </>;
                  })()}
                  <Line dataKey="close" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
                  <Customized component={(props: any) => <CandleSticks {...props} data={ohlcData} />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {showSQZ && (
              <div className="w-full h-[50px] pb-2 pr-11">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrichedLine} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="sqzMomentum">
                      {enrichedLine.map((e, i) => <Cell key={i} fill={(e.sqzMomentum || 0) > 0 ? '#22c55e' : '#ef4444'} />)}
                    </Bar>
                    <XAxis dataKey="date" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        {/* Indicator mini-bar */}
        {ind && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'EMA50', val: ind.ema ? `$${ind.ema >= 1000 ? (ind.ema / 1000).toFixed(2) + 'k' : ind.ema.toFixed(2)}` : '--' },
              { label: 'BB Width', val: ind.bbWidth ? `${ind.bbWidth.toFixed(1)}%` : '--' },
              { label: 'SQZ', val: ind.inSqueeze ? '🔵 En squeeze' : ind.sqzMomentum !== null ? (ind.sqzMomentum > 0 ? '🟢 Positivo' : '🔴 Negativo') : '--' },
              { label: 'RSI (14)', val: ind.rsi ? ind.rsi.toFixed(1) : '--' },
            ].map(({ label, val }) => (
              <div key={label} className="bg-card border border-border/50 rounded-xl p-2.5 flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Analysis card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Smart Analysis Engine
              <Badge className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono">SAE v1</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Button
              className="w-full h-11 font-bold bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando...</>
              ) : (
                <><Cpu className="w-4 h-4" /> Analizar {selectedAsset}</>
              )}
            </Button>

            {result && (
              <>
                {/* Signal badge */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm ${signalColor}`}>
                  <SignalIcon className="w-4 h-4 shrink-0" />
                  <span>{result.signal.type === 'BUY' ? 'COMPRA' : result.signal.type === 'SELL' ? 'VENTA' : 'ESPERAR'}</span>
                  <span className="ml-auto font-mono text-xs opacity-80">Score {result.indicadores ? result.signal.score.toFixed(0) : '--'}/100</span>
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
              </>
            )}

            {!result && !isAnalyzing && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Pulsa el botón para generar un análisis técnico completo basado en EMA, Bollinger Bands, RSI y Squeeze Momentum. Sin coste de API.
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
