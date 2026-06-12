import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsset } from '@/context/AssetContext';
import { useAssetData } from '@/hooks/useAssetData';
import { streamAnalysis } from '@/services/aiService';
import {
  fetchOHLCData, OHLCPoint, ChartTimeframe,
  fetchChartDataByTimeframe, ChartPoint,
} from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';
import {
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, BarChart, Bar, Cell, Customized,
} from 'recharts';
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

// ── Candle renderer ──────────────────────────────────────────────────────────
const CandleSticks = ({ xAxisMap, yAxisMap, data }: any) => {
  if (!xAxisMap || !yAxisMap || !data?.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const bandwidth: number = typeof xScale.bandwidth === 'function'
    ? xScale.bandwidth()
    : (xAxis.width ?? 300) / data.length;

  return (
    <g>
      {(data as OHLCPoint[]).map((p, i) => {
        const x0 = xScale(p.date);
        if (x0 == null) return null;
        const cx = x0 + bandwidth / 2;
        const w = Math.max(bandwidth * 0.65, 2);
        const openY = yScale(p.open);
        const closeY = yScale(p.close);
        const highY = yScale(p.high);
        const lowY = yScale(p.low);
        const isGreen = p.close >= p.open;
        const color = isGreen ? '#22c55e' : '#ef4444';
        return (
          <g key={i}>
            <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} opacity={0.9} />
            <rect
              x={cx - w / 2} y={Math.min(openY, closeY)}
              width={w} height={Math.max(Math.abs(closeY - openY), 1.5)}
              fill={color} stroke={isGreen ? '#16a34a' : '#dc2626'} strokeWidth={0.5} opacity={0.9}
            />
          </g>
        );
      })}
    </g>
  );
};

const CandleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as OHLCPoint;
  if (!d?.open) return null;
  const fmt = (v: number) => v >= 1 ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${v.toFixed(5)}`;
  const isGreen = d.close >= d.open;
  return (
    <div className="bg-black border border-border rounded-lg p-2.5 text-xs font-mono shadow-xl min-w-[140px]">
      <div className="text-muted-foreground mb-1.5 text-[10px]">{label}</div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">O</span><span>{fmt(d.open)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-green-400">H</span><span className="text-green-400">{fmt(d.high)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-red-400">L</span><span className="text-red-400">{fmt(d.low)}</span></div>
        <div className={`flex justify-between gap-3 font-bold ${isGreen ? 'text-green-400' : 'text-red-400'}`}>
          <span>C</span><span>{fmt(d.close)}</span>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const TIMEFRAMES: ChartTimeframe[] = ['1D', '7D', '1M'];

export default function AIAnalysis() {
  const { selectedAsset } = useAsset();
  const { assetData } = useAssetData(selectedAsset);

  const [timeframe, setTimeframe] = useState<ChartTimeframe>('7D');
  const [ohlcData, setOhlcData] = useState<OHLCPoint[]>([]);
  const [lineData, setLineData] = useState<ChartPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showSQZ, setShowSQZ] = useState(false);

  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const analysisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingChart(true);
      const [ohlc, line] = await Promise.all([
        fetchOHLCData(selectedAsset, timeframe),
        fetchChartDataByTimeframe(selectedAsset, timeframe),
      ]);
      if (mounted) {
        if (ohlc.length) setOhlcData(ohlc);
        if (line.length) setLineData(line);
        setLoadingChart(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedAsset, timeframe]);

  // Indicators on line data
  const enrichedLine = (() => {
    if (!lineData.length) return [];
    const prices = lineData.map(d => d.price);
    const ema = showEMA ? calculateEMA(prices, Math.min(50, prices.length)) : [];
    const bb = showBB ? calculateBollingerBands(prices, 20) : [];
    const sqz = showSQZ ? calculateSqueezeMomentum(prices) : [];
    return lineData.map((pt, i) => ({
      ...pt,
      ema: showEMA ? (ema[i] ?? null) : undefined,
      bbUpper: showBB ? (bb[i]?.upper ?? null) : undefined,
      bbMiddle: showBB ? (bb[i]?.middle ?? null) : undefined,
      bbLower: showBB ? (bb[i]?.lower ?? null) : undefined,
      sqzMomentum: showSQZ ? (sqz[i]?.momentum ?? null) : undefined,
    }));
  })();

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low)) * 0.998 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;

  const fmtY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  const handleAnalyze = () => {
    if (!assetData || isAnalyzing) return;
    setAnalysisText('');
    setAnalysisError('');
    setIsAnalyzing(true);

    streamAnalysis(
      {
        symbol: selectedAsset,
        price: assetData.price,
        change24h: assetData.change24h,
        radarScore: assetData.radarScore,
        upperZones: assetData.upperZoneLevels,
        lowerZones: assetData.lowerZoneLevels,
        bias: assetData.bias,
      },
      (chunk) => {
        setAnalysisText(prev => prev + chunk);
        setTimeout(() => analysisRef.current?.scrollTo({ top: analysisRef.current.scrollHeight, behavior: 'smooth' }), 50);
      },
      () => setIsAnalyzing(false),
      (err) => { setAnalysisError(err); setIsAnalyzing(false); }
    );
  };

  const isPositive = (assetData?.change24h ?? 0) >= 0;
  const BiasIcon = assetData?.bias === 'bullish'
    ? TrendingUp
    : assetData?.bias === 'bearish'
      ? TrendingDown
      : Minus;

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Análisis IA</h1>
              <p className="text-[10px] text-muted-foreground">Powered by GPT-4o</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">
              ${(assetData?.price ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: assetData?.price && assetData.price < 1 ? 4 : 2 })}
            </div>
            <div className={`text-xs font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(assetData?.change24h ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-xl p-2.5 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Radar Score</div>
            <div className="font-mono font-bold text-primary">{assetData?.radarScore ?? '--'}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-2.5 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Sesgo</div>
            <div className={`font-bold text-xs flex items-center justify-center gap-1 ${
              assetData?.bias === 'bullish' ? 'text-green-400' :
              assetData?.bias === 'bearish' ? 'text-red-400' : 'text-muted-foreground'
            }`}>
              <BiasIcon className="w-3 h-3" />
              {assetData?.bias ?? 'NEUTRAL'}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-2.5 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Asset</div>
            <div className="font-mono font-bold text-sm">{selectedAsset}</div>
          </div>
        </div>

        {/* Chart card */}
        <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden">
          <CardHeader className="p-3 pb-2 border-b border-border/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Timeframe */}
              <div className="flex gap-1">
                {TIMEFRAMES.map(tf => (
                  <Button key={tf} variant="ghost" size="sm" onClick={() => setTimeframe(tf)}
                    className={`h-6 px-2 text-[10px] ${timeframe === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                    {tf}
                  </Button>
                ))}
              </div>
              {/* Indicators */}
              <div className="flex gap-1">
                {[
                  { key: 'EMA', active: showEMA, toggle: () => setShowEMA(v => !v), color: 'orange' },
                  { key: 'BB', active: showBB, toggle: () => setShowBB(v => !v), color: 'blue' },
                  { key: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), color: 'purple' },
                ].map(({ key, active, toggle, color }) => (
                  <Button key={key} variant="outline" size="sm" onClick={toggle}
                    className={`h-6 px-2 text-[10px] ${active
                      ? `bg-${color}-500/20 text-${color}-400 border-${color}-500/40`
                      : 'text-muted-foreground border-border/40'}`}>
                    {key}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative">
            {loadingChart && (
              <div className="absolute inset-0 z-10 bg-background/60 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            )}
            {/* Candle chart */}
            <div style={{ height: showSQZ ? 250 : 290 }} className="w-full pt-3 pr-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4} />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false} tickFormatter={fmtY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} orientation="right" width={46} />
                  <Tooltip content={<CandleTooltip />} />
                  {assetData?.price && <ReferenceLine y={assetData.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />}
                  {assetData?.upperZoneLevels?.map((z, i) => <ReferenceLine key={`u${i}`} y={z.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.25} />)}
                  {assetData?.lowerZoneLevels?.map((z, i) => <ReferenceLine key={`l${i}`} y={z.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.25} />)}
                  {/* EMA on candles from line data mapped by date */}
                  {showEMA && enrichedLine.length > 0 && (() => {
                    const emaMap = new Map(enrichedLine.map(d => [d.date, d.ema]));
                    const enrichedOHLC = ohlcData.map(d => ({ ...d, ema: emaMap.get(d.date) ?? null }));
                    return <Line data={enrichedOHLC} type="monotone" dataKey="ema" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />;
                  })()}
                  {showBB && enrichedLine.length > 0 && (() => {
                    const bbUMap = new Map(enrichedLine.map(d => [d.date, d.bbUpper]));
                    const bbMMap = new Map(enrichedLine.map(d => [d.date, d.bbMiddle]));
                    const bbLMap = new Map(enrichedLine.map(d => [d.date, d.bbLower]));
                    const eo = ohlcData.map(d => ({ ...d, bbU: bbUMap.get(d.date) ?? null, bbM: bbMMap.get(d.date) ?? null, bbL: bbLMap.get(d.date) ?? null }));
                    return <>
                      <Line data={eo} type="monotone" dataKey="bbU" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                      <Line data={eo} type="monotone" dataKey="bbM" stroke="#3b82f6" strokeWidth={1} opacity={0.45} dot={false} isAnimationActive={false} connectNulls />
                      <Line data={eo} type="monotone" dataKey="bbL" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                    </>;
                  })()}
                  <Line dataKey="close" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
                  <Customized component={(props: any) => <CandleSticks {...props} data={ohlcData} />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* SQZ panel */}
            {showSQZ && (
              <div className="w-full h-[52px] pb-2 pr-11">
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
          </CardContent>
        </Card>

        {/* AI Analysis button & output */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Análisis inteligente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Button
              className="w-full h-11 font-bold bg-purple-600 hover:bg-purple-700 text-white gap-2"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !assetData?.price}
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando {selectedAsset}...</>
              ) : (
                <><Brain className="w-4 h-4" /> Analizar {selectedAsset} con IA</>
              )}
            </Button>

            {analysisError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {analysisError}
              </div>
            )}

            {(analysisText || isAnalyzing) && (
              <div
                ref={analysisRef}
                className="max-h-[480px] overflow-y-auto rounded-xl bg-[#0a0a0a] border border-border/50 p-4 text-sm leading-relaxed font-sans space-y-1"
              >
                {analysisText ? (
                  analysisText.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2" />;
                    const isHeader = /^[0-9]\./.test(line) || /^[📊🔴🟢📈📉⚡⚠️]/.test(line);
                    return (
                      <p key={i} className={isHeader ? 'font-semibold text-foreground mt-3 first:mt-0' : 'text-muted-foreground'}>
                        {line}
                      </p>
                    );
                  })
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Generando análisis...</span>
                  </div>
                )}
                {isAnalyzing && analysisText && (
                  <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 rounded-sm" />
                )}
              </div>
            )}

            {!analysisText && !isAnalyzing && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Pulsa el botón para obtener un análisis técnico completo con zonas clave, señales y gestión de riesgo.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground/50 text-center px-4">
          El análisis es orientativo y no constituye asesoramiento financiero. Invierte con responsabilidad.
        </p>
      </motion.div>
    </div>
  );
}
