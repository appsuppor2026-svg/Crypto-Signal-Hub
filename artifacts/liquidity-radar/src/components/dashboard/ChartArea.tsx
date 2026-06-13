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

interface ChartAreaProps { asset: AssetData; }
type ChartMode = 'line' | 'candles';

// ── Adaptive small periods ────────────────────────────────────────────────────
const emaPer = (n: number) => Math.min(9,  Math.max(3, Math.floor(n * 0.25)));
const bbPer  = (n: number) => Math.min(10, Math.max(3, Math.floor(n * 0.25)));
const sqzPer = (n: number) => Math.min(10, Math.max(3, Math.floor(n * 0.25)));

// ── Custom candle SVG renderer ────────────────────────────────────────────────
// recharts ComposedChart+Line uses scalePoint: xScale(val) = CENTRE x position.
// scaleBand: xScale(val) = LEFT edge (add bandwidth/2 for centre).
const CandleSticks = ({ xAxisMap, yAxisMap, data }: any) => {
  if (!xAxisMap || !yAxisMap || !data?.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale  = xAxis.scale;
  const yScale  = yAxis.scale;
  const isBand  = typeof xScale.bandwidth === 'function';
  const range   = xScale.range?.() as [number, number] | undefined;
  const n       = (data as OHLCPoint[]).length;
  const step: number = isBand
    ? xScale.bandwidth()
    : range && n > 1 ? (range[1] - range[0]) / (n - 1) : 8;

  return (
    <g>
      {(data as OHLCPoint[]).map((p) => {
        const x0 = xScale(p.date);
        if (x0 == null) return null;
        const cx = isBand ? x0 + step / 2 : x0;
        const cw = Math.max(step * 0.58, 1.5);
        const oY = yScale(p.open),  cY = yScale(p.close);
        const hY = yScale(p.high),  lY = yScale(p.low);
        const up  = p.close >= p.open;
        const col = up ? '#22c55e' : '#ef4444';
        return (
          <g key={p.timestamp}>
            <line x1={cx} y1={hY} x2={cx} y2={lY} stroke={col} strokeWidth={1} opacity={0.9} />
            <rect x={cx - cw / 2} y={Math.min(oY, cY)}
              width={cw} height={Math.max(Math.abs(cY - oY), 1.5)}
              fill={col} stroke={up ? '#16a34a' : '#dc2626'} strokeWidth={0.5} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

// ── Indicator overlay SVG (drawn ON TOP of candles) ──────────────────────────
interface IndicatorOverlayProps {
  xAxisMap?: any; yAxisMap?: any;
  emaValues: (number | null)[];
  bbUValues: (number | null)[];
  bbMValues: (number | null)[];
  bbLValues: (number | null)[];
  data: OHLCPoint[];
  showEMA: boolean;
  showBB: boolean;
}
const IndicatorOverlay = ({ xAxisMap, yAxisMap, emaValues, bbUValues, bbMValues, bbLValues, data, showEMA, showBB }: IndicatorOverlayProps) => {
  if (!xAxisMap || !yAxisMap || !data.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const isBand = typeof xScale.bandwidth === 'function';
  const range  = xScale.range?.() as [number, number] | undefined;
  const n      = data.length;
  const step: number = isBand ? xScale.bandwidth()
    : range && n > 1 ? (range[1] - range[0]) / (n - 1) : 8;

  const pts = data.map((p, i) => {
    const x0 = xScale(p.date);
    if (x0 == null) return null;
    const cx = isBand ? x0 + step / 2 : x0;
    return { cx, ema: emaValues[i], bbU: bbUValues[i], bbM: bbMValues[i], bbL: bbLValues[i] };
  }).filter(Boolean) as { cx: number; ema: number | null; bbU: number | null; bbM: number | null; bbL: number | null }[];

  const toPath = (vals: (number | null)[], xs: number[]): string => {
    let d = '';
    vals.forEach((v, i) => {
      if (v == null) return;
      const y = yScale(v);
      d += d === '' || vals[i - 1] == null ? `M${xs[i]},${y}` : `L${xs[i]},${y}`;
    });
    return d;
  };

  const xs = pts.map(p => p.cx);

  return (
    <g>
      {showEMA && (
        <path d={toPath(pts.map(p => p.ema), xs)} fill="none" stroke="#f97316" strokeWidth={1.5} opacity={0.9} />
      )}
      {showBB && (
        <>
          <path d={toPath(pts.map(p => p.bbU), xs)} fill="none" stroke="#60a5fa" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.9} />
          <path d={toPath(pts.map(p => p.bbM), xs)} fill="none" stroke="#60a5fa" strokeWidth={0.8} opacity={0.5} />
          <path d={toPath(pts.map(p => p.bbL), xs)} fill="none" stroke="#60a5fa" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.9} />
        </>
      )}
    </g>
  );
};

// ── SQZ overlay ──────────────────────────────────────────────────────────────
interface SqzOverlayProps {
  xAxisMap?: any; yAxisMap?: any;
  sqzValues: (number | null)[];
  data: OHLCPoint[];
}
const SqzBars = ({ xAxisMap, yAxisMap, sqzValues, data }: SqzOverlayProps) => {
  if (!xAxisMap || !yAxisMap || !data.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const isBand = typeof xScale.bandwidth === 'function';
  const range  = xScale.range?.() as [number, number] | undefined;
  const n      = data.length;
  const step: number = isBand ? xScale.bandwidth()
    : range && n > 1 ? (range[1] - range[0]) / (n - 1) : 8;
  const zero = yScale(0);

  return (
    <g>
      {data.map((p, i) => {
        const v = sqzValues[i];
        if (v == null) return null;
        const x0 = xScale(p.date);
        if (x0 == null) return null;
        const cx = isBand ? x0 + step / 2 : x0;
        const barW = Math.max(step * 0.55, 1.5);
        const y = yScale(v);
        const col = v > 0 ? '#22c55e' : '#ef4444';
        return (
          <rect key={p.timestamp}
            x={cx - barW / 2} y={Math.min(y, zero)}
            width={barW} height={Math.max(Math.abs(y - zero), 1)}
            fill={col} opacity={0.85} />
        );
      })}
    </g>
  );
};

// ── Price label ───────────────────────────────────────────────────────────────
const PriceLabel = ({ viewBox, price }: any) => {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(2)}k` : `$${v.toFixed(2)}`;
  return (
    <g>
      <rect x={x + width - 52} y={y - 9} width={52} height={17} rx={3}
        fill="#0a0a0a" stroke="hsl(var(--primary))" strokeWidth={0.8} opacity={0.9} />
      <text x={x + width - 26} y={y + 4} textAnchor="middle"
        fontSize={9} fontFamily="monospace" fill="hsl(var(--primary))" fontWeight="bold">
        {fmt(price)}
      </text>
    </g>
  );
};

const CandleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as OHLCPoint;
  if (!d?.open) return null;
  const g   = d.close >= d.open;
  const fmt = (v: number) => v >= 1
    ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toFixed(5)}`;
  return (
    <div className="bg-black border border-border rounded-lg p-3 text-xs font-mono shadow-xl min-w-[150px]">
      <div className="text-muted-foreground mb-1.5 text-[10px]">{label}</div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">O</span><span>{fmt(d.open)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-green-400">H</span><span className="text-green-400">{fmt(d.high)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-red-400">L</span><span className="text-red-400">{fmt(d.low)}</span></div>
        <div className={`flex justify-between gap-4 font-bold ${g ? 'text-green-400' : 'text-red-400'}`}><span>C</span><span>{fmt(d.close)}</span></div>
      </div>
    </div>
  );
};

const TF_GROUPS: ChartTimeframe[][] = [['5M','15M','1H','4H'], ['1D','7D','1M']];
const TF_LABELS: Record<ChartTimeframe, string> = {
  '5M':'5m','15M':'15m','1H':'1h','4H':'4h','1D':'1D','7D':'7D','1M':'1M',
};

// ── Main component ────────────────────────────────────────────────────────────
export function ChartArea({ asset }: ChartAreaProps) {
  const [selectedTF, setSelectedTF] = useState<ChartTimeframe>('1H');
  const [chartMode,  setChartMode]  = useState<ChartMode>('candles');
  const [chartData,  setChartData]  = useState<ChartPoint[]>(asset.chartData ?? []);
  const [ohlcData,   setOhlcData]   = useState<OHLCPoint[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);

  // Indicator toggles (candles only)
  const [showEMA, setShowEMA] = useState(false);
  const [showBB,  setShowBB]  = useState(false);
  const [showSQZ, setShowSQZ] = useState(false);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    Promise.all([
      fetchOHLCData(asset.symbol, selectedTF),
      fetchChartDataByTimeframe(asset.symbol, selectedTF),
    ]).then(([ohlc, line]) => {
      if (!alive) return;
      if (ohlc.length  > 0) setOhlcData(ohlc);
      if (line.length  > 0) setChartData(line);
      setIsLoading(false);
    });
    return () => { alive = false; };
  }, [asset.symbol, selectedTF]);

  useEffect(() => {
    setSelectedTF('1H');
    setOhlcData([]);
    setChartData(asset.chartData ?? []);
  }, [asset.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const strokeColor = asset.change24h >= 0 ? '#22c55e' : '#ef4444';
  const formatY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  // ── Pre-compute indicator arrays from candle closes ───────────────────────
  const candleInd = useMemo(() => {
    if (!ohlcData.length) return { ema: [] as (number|null)[], bbU: [] as (number|null)[], bbM: [] as (number|null)[], bbL: [] as (number|null)[], sqz: [] as (number|null)[] };
    const prices = ohlcData.map(d => d.close);
    const ep = emaPer(prices.length);
    const bp = bbPer(prices.length);
    const sp = sqzPer(prices.length);
    const ema = calculateEMA(prices, ep);
    const bb  = calculateBollingerBands(prices, bp);
    const sqz = calculateSqueezeMomentum(prices, sp, sp, 1.5);
    return {
      ema,
      bbU: bb.map(b => b.upper),
      bbM: bb.map(b => b.middle),
      bbL: bb.map(b => b.lower),
      sqz: sqz.map(s => s.momentum),
    };
  }, [ohlcData]);

  const lineMin = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0;
  const lineMax = chartData.length ? Math.max(...chartData.map(d => d.price)) : 0;
  const linePad = (lineMax - lineMin) * 0.15 || lineMax * 0.02;
  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low))  * 0.998 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;

  const displayMode: ChartMode =
    chartMode === 'candles' && ohlcData.length === 0 && !isLoading ? 'line' : chartMode;

  // SQZ sub-panel height
  const sqzH   = 50;
  const candleH = displayMode === 'candles' && showSQZ ? 265 : 310;
  const lineH   = 295;

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-3 pb-2 border-b border-border/30 space-y-2">

        {/* Row 1: mode toggle + timeframes */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex bg-muted/40 rounded-lg p-0.5 shrink-0">
            {(['line','candles'] as ChartMode[]).map(m => (
              <Button key={m} variant="ghost" size="sm" onClick={() => setChartMode(m)}
                className={`h-6 px-2 text-[10px] rounded-md ${displayMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'candles' ? '🕯 Velas' : '📈 Línea'}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {TF_GROUPS[0].map(tf => (
              <Button key={tf} variant="ghost" size="sm" onClick={() => setSelectedTF(tf)}
                className={`h-6 px-1.5 text-[10px] min-w-[26px] ${selectedTF === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                {TF_LABELS[tf]}
              </Button>
            ))}
            <div className="w-px h-4 bg-border/40 mx-0.5" />
            {TF_GROUPS[1].map(tf => (
              <Button key={tf} variant="ghost" size="sm" onClick={() => setSelectedTF(tf)}
                className={`h-6 px-1.5 text-[10px] min-w-[26px] ${selectedTF === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}>
                {TF_LABELS[tf]}
              </Button>
            ))}
          </div>
        </div>

        {/* Row 2: indicator toggles — CANDLES mode only */}
        {displayMode === 'candles' && (
          <div className="flex gap-1.5 items-center">
            {([
              { key: 'EMA', active: showEMA, toggle: () => setShowEMA(v => !v), cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
              { key: 'BB',  active: showBB,  toggle: () => setShowBB(v => !v),  cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
              { key: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
            ] as const).map(({ key, active, toggle, cls }) => (
              <Button key={key} variant="outline" size="sm" onClick={toggle}
                className={`h-6 px-2 text-[10px] transition-colors ${active ? cls : 'text-muted-foreground border-border/50'}`}>
                {key}
              </Button>
            ))}
            <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono">
              {ohlcData.length}v · EMA{emaPer(ohlcData.length)} BB{bbPer(ohlcData.length)}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}

        {/* ── LINE MODE ─────────────────────────────────────────────── */}
        {displayMode === 'line' && (
          <div style={{ height: lineH }} className="w-full pt-3 pr-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="lrAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.25} />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4}
                  interval="preserveStartEnd" />
                <YAxis domain={[lineMin - linePad, lineMax + linePad]} axisLine={false} tickLine={false}
                  tickFormatter={formatY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  orientation="right" width={52} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#000', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                />
                <ReferenceLine y={asset.price} stroke="hsl(var(--primary))" strokeWidth={1.5}
                  strokeDasharray="5 3" opacity={0.85}
                  label={<PriceLabel price={asset.price} />} />
                {asset.upperZoneLevels?.map((lv, i) => (
                  <ReferenceLine key={`u${i}`} y={lv.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
                ))}
                {asset.lowerZoneLevels?.map((lv, i) => (
                  <ReferenceLine key={`l${i}`} y={lv.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
                ))}
                <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2}
                  fillOpacity={1} fill="url(#lrAreaGrad)"
                  isAnimationActive animationDuration={600}
                  activeDot={{ r: 3, strokeWidth: 0, fill: strokeColor }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── CANDLES MODE ───────────────────────────────────────────── */}
        {displayMode === 'candles' && (
          <>
            <div style={{ height: candleH }} className="w-full pt-3 pr-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4}
                    interval="preserveStartEnd" />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false}
                    tickFormatter={formatY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    orientation="right" width={52} />
                  <Tooltip content={<CandleTooltip />} />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--primary))" strokeWidth={1.5}
                    strokeDasharray="5 3" opacity={0.85}
                    label={<PriceLabel price={asset.price} />} />
                  {asset.upperZoneLevels?.map((lv, i) => (
                    <ReferenceLine key={`uc${i}`} y={lv.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {asset.lowerZoneLevels?.map((lv, i) => (
                    <ReferenceLine key={`lc${i}`} y={lv.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {/* Anchor line: lets recharts set up Y-scale from ohlcData[].close */}
                  <Line dataKey="close" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />

                  {/* Layer 1: Candles */}
                  <Customized component={(p: any) => <CandleSticks {...p} data={ohlcData} />} />

                  {/* Layer 2: EMA + BB drawn ON TOP of candles via pure SVG */}
                  {(showEMA || showBB) && (
                    <Customized component={(p: any) => (
                      <IndicatorOverlay
                        {...p}
                        data={ohlcData}
                        emaValues={candleInd.ema}
                        bbUValues={candleInd.bbU}
                        bbMValues={candleInd.bbM}
                        bbLValues={candleInd.bbL}
                        showEMA={showEMA}
                        showBB={showBB}
                      />
                    )} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* SQZ sub-panel */}
            {showSQZ && (
              <div style={{ height: sqzH }} className="w-full pb-2 pr-12">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ohlcData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Customized component={(p: any) => (
                      <SqzBars {...p} data={ohlcData} sqzValues={candleInd.sqz} />
                    )} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
