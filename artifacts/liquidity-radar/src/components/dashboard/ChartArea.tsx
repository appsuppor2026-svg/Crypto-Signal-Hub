import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AssetData } from '@/types';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, BarChart, Bar, Cell, Customized,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartTimeframe, fetchChartDataByTimeframe, ChartPoint,
  fetchOHLCData, OHLCPoint,
} from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';

interface ChartAreaProps {
  asset: AssetData;
}

type ChartMode = 'line' | 'candles';

// ── Candle renderer ──────────────────────────────────────────────────────────
const CandleSticks = ({ xAxisMap, yAxisMap, data }: any) => {
  if (!xAxisMap || !yAxisMap || !data?.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;

  // Compute bandwidth for point/ordinal scale
  const bandwidth: number = (() => {
    if (typeof xScale.bandwidth === 'function') return xScale.bandwidth();
    const range = xScale.range?.() as [number, number] | undefined;
    if (range && data.length > 1) return (range[1] - range[0]) / data.length;
    return 8;
  })();

  return (
    <g>
      {(data as OHLCPoint[]).map((point, i) => {
        const x0 = xScale(point.date);
        if (x0 == null) return null;
        const cx = x0 + bandwidth / 2;
        const candleW = Math.max(bandwidth * 0.65, 1.5);

        const openY: number = yScale(point.open);
        const closeY: number = yScale(point.close);
        const highY: number = yScale(point.high);
        const lowY: number = yScale(point.low);

        const isGreen = point.close >= point.open;
        const color = isGreen ? '#22c55e' : '#ef4444';
        const bodyTop = Math.min(openY, closeY);
        const bodyH = Math.max(Math.abs(closeY - openY), 1.5);

        return (
          <g key={i}>
            <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} opacity={0.9} />
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={color}
              stroke={isGreen ? '#16a34a' : '#dc2626'}
              strokeWidth={0.5}
              opacity={0.9}
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
  const isGreen = d.close >= d.open;
  const fmt = (v: number) =>
    v >= 1
      ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${v.toFixed(5)}`;
  return (
    <div className="bg-black border border-border rounded-lg p-3 text-xs font-mono shadow-xl min-w-[150px]">
      <div className="text-muted-foreground mb-1.5 text-[10px]">{label}</div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">O</span><span>{fmt(d.open)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-green-400">H</span><span className="text-green-400">{fmt(d.high)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-red-400">L</span><span className="text-red-400">{fmt(d.low)}</span></div>
        <div className={`flex justify-between gap-4 font-bold ${isGreen ? 'text-green-400' : 'text-red-400'}`}>
          <span>C</span><span>{fmt(d.close)}</span>
        </div>
      </div>
    </div>
  );
};

// Timeframe groups for layout
const TF_GROUPS: ChartTimeframe[][] = [
  ['5M', '15M', '1H', '4H'],
  ['1D', '7D', '1M'],
];

const TF_LABELS: Record<ChartTimeframe, string> = {
  '5M': '5m', '15M': '15m', '1H': '1h', '4H': '4h',
  '1D': '1D', '7D': '7D', '1M': '1M',
};

export function ChartArea({ asset }: ChartAreaProps) {
  const [selectedTF, setSelectedTF] = useState<ChartTimeframe>('1H');
  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [chartData, setChartData] = useState<ChartPoint[]>(asset.chartData);
  const [ohlcData, setOhlcData] = useState<OHLCPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showEMA, setShowEMA] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showSQZ, setShowSQZ] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setOhlcData([]);
      setChartData([]);
      const [ohlc, line] = await Promise.all([
        fetchOHLCData(asset.symbol, selectedTF),
        fetchChartDataByTimeframe(asset.symbol, selectedTF),
      ]);
      if (!mounted) return;
      if (ohlc.length) setOhlcData(ohlc);
      if (line.length) setChartData(line);
      setIsLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [asset.symbol, selectedTF]);

  useEffect(() => {
    setSelectedTF('1H');
    setOhlcData([]);
  }, [asset.symbol]);

  const isPositive = asset.change24h >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  const formatY = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  const enrichedLine = useMemo(() => {
    if (!chartData.length) return [];
    const prices = chartData.map(d => d.price);
    const ema = showEMA ? calculateEMA(prices, Math.min(50, prices.length)) : [];
    const bb = showBB ? calculateBollingerBands(prices, Math.min(20, prices.length)) : [];
    const sqz = showSQZ ? calculateSqueezeMomentum(prices) : [];
    return chartData.map((pt, i) => ({
      ...pt,
      ema: showEMA ? (ema[i] ?? null) : undefined,
      bbUpper: showBB ? (bb[i]?.upper ?? null) : undefined,
      bbMiddle: showBB ? (bb[i]?.middle ?? null) : undefined,
      bbLower: showBB ? (bb[i]?.lower ?? null) : undefined,
      sqzMomentum: showSQZ ? (sqz[i]?.momentum ?? null) : undefined,
    }));
  }, [chartData, showEMA, showBB, showSQZ]);

  const lineMin = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0;
  const lineMax = chartData.length ? Math.max(...chartData.map(d => d.price)) : 0;
  const linePad = (lineMax - lineMin) * 0.15;

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low)) * 0.998 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;

  // Use candles when available, line as fallback
  const displayMode: ChartMode = chartMode === 'candles' && ohlcData.length === 0 && !isLoading ? 'line' : chartMode;

  const chartH = showSQZ && displayMode === 'line' ? 255 : 290;

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-3 pb-2 border-b border-border/30 space-y-2">
        {/* Row 1: mode toggle + timeframe groups */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          {/* Candles / Línea */}
          <div className="flex bg-muted/40 rounded-lg p-0.5 shrink-0">
            {(['line', 'candles'] as ChartMode[]).map(m => (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                onClick={() => setChartMode(m)}
                className={`h-6 px-2 text-[10px] rounded-md ${displayMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {m === 'candles' ? '🕯 Velas' : '📈 Línea'}
              </Button>
            ))}
          </div>

          {/* Timeframes — two groups separated by thin divider */}
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {TF_GROUPS[0].map(tf => (
              <Button key={tf} variant="ghost" size="sm" onClick={() => setSelectedTF(tf)}
                className={`h-6 px-1.5 text-[10px] min-w-[28px] ${selectedTF === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                {TF_LABELS[tf]}
              </Button>
            ))}
            <div className="w-px h-4 bg-border/40 mx-0.5" />
            {TF_GROUPS[1].map(tf => (
              <Button key={tf} variant="ghost" size="sm" onClick={() => setSelectedTF(tf)}
                className={`h-6 px-1.5 text-[10px] min-w-[28px] ${selectedTF === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                {TF_LABELS[tf]}
              </Button>
            ))}
          </div>
        </div>

        {/* Row 2: indicators (line mode) */}
        {displayMode === 'line' && (
          <div className="flex gap-1.5">
            {[
              { key: 'EMA', active: showEMA, toggle: () => setShowEMA(v => !v), cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
              { key: 'BB', active: showBB, toggle: () => setShowBB(v => !v), cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
              { key: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
            ].map(({ key, active, toggle, cls }) => (
              <Button key={key} variant="outline" size="sm" onClick={toggle}
                className={`h-6 px-2 text-[10px] ${active ? cls : 'text-muted-foreground border-border/50'}`}>
                {key}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}

        {displayMode === 'line' ? (
          <>
            <div style={{ height: chartH }} className="w-full pt-3 pr-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={enrichedLine} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cgPriceLR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.25} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4} />
                  <YAxis domain={[lineMin - linePad, lineMax + linePad]} axisLine={false} tickLine={false} tickFormatter={formatY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} orientation="right" width={48} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                  />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
                  {asset.upperZoneLevels?.map((lv, i) => <ReferenceLine key={`u${i}`} y={lv.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />)}
                  {asset.lowerZoneLevels?.map((lv, i) => <ReferenceLine key={`l${i}`} y={lv.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />)}
                  <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2} fillOpacity={1} fill="url(#cgPriceLR)" isAnimationActive animationDuration={600} activeDot={{ r: 3, strokeWidth: 0, fill: strokeColor }} />
                  {showEMA && <Line type="monotone" dataKey="ema" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />}
                  {showBB && <>
                    <Line type="monotone" dataKey="bbUpper" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="bbMiddle" stroke="#3b82f6" strokeWidth={1} opacity={0.45} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="bbLower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                  </>}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
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
          </>
        ) : (
          <div style={{ height: 310 }} className="w-full pt-3 pr-1">
            {ohlcData.length === 0 && !isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs gap-2">
                <span>Cargando velas...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    dy={4}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[ohlcMin, ohlcMax]}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatY}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    orientation="right"
                    width={48}
                  />
                  <Tooltip content={<CandleTooltip />} />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
                  {asset.upperZoneLevels?.map((lv, i) => <ReferenceLine key={`uc${i}`} y={lv.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />)}
                  {asset.lowerZoneLevels?.map((lv, i) => <ReferenceLine key={`lc${i}`} y={lv.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />)}
                  {/* Anchor line for Y-scale, transparent */}
                  <Line dataKey="close" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
                  <Customized component={(props: any) => <CandleSticks {...props} data={ohlcData} />} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
