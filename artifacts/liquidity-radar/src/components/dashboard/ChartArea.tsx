import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AssetData } from '@/types';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, BarChart, Bar, Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartTimeframe, fetchChartDataByTimeframe, ChartPoint,
  fetchOHLCData, OHLCPoint,
} from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';
import { CandleCanvas } from './CandleCanvas';
import { useTranslation } from '@/i18n';

interface ChartAreaProps { asset: AssetData; }
type ChartMode = 'line' | 'candles';

const emaPer = (n: number) => Math.min(50, Math.max(5, Math.floor(n * 0.7)));
const bbPer  = (n: number) => Math.min(20, Math.max(5, Math.floor(n * 0.25)));
const sqzPer = (n: number) => Math.min(20, Math.max(5, Math.floor(n * 0.25)));

// ── Price label on reference line ─────────────────────────────────────────────
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
  const { t } = useTranslation();
  const [selectedTF, setSelectedTF] = useState<ChartTimeframe>('1H');
  const [chartMode,  setChartMode]  = useState<ChartMode>('candles');
  const [chartData,  setChartData]  = useState<ChartPoint[]>(asset.chartData ?? []);
  const [ohlcData,   setOhlcData]   = useState<OHLCPoint[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);

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
    }).catch(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [asset.symbol, selectedTF]);

  useEffect(() => {
    setSelectedTF('1H');
    setOhlcData([]);
    setChartData(asset.chartData ?? []);
  }, [asset.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const strokeColor = asset.change24h >= 0 ? '#22c55e' : '#ef4444';
  const formatY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  // Indicator arrays from OHLC close prices
  const candleInd = useMemo(() => {
    if (!ohlcData.length) return {
      ema: [] as (number|null)[], bbU: [] as (number|null)[],
      bbM: [] as (number|null)[], bbL: [] as (number|null)[],
      sqz: [] as (number|null)[],
    };
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

  const lineMin  = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0;
  const lineMax  = chartData.length ? Math.max(...chartData.map(d => d.price)) : 0;
  const linePad  = (lineMax - lineMin) * 0.15 || lineMax * 0.02;
  const ohlcMin  = ohlcData.length ? Math.min(...ohlcData.map(d => d.low))  * 0.998 : 0;
  const ohlcMax  = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;

  const displayMode: ChartMode =
    chartMode === 'candles' && ohlcData.length === 0 && !isLoading ? 'line' : chartMode;

  const sqzH    = 50;
  const candleH = displayMode === 'candles' && showSQZ ? 265 : 310;
  const lineH   = 295;

  // SQZ data for bar chart
  const sqzBarData = useMemo(() =>
    ohlcData.map((d, i) => ({ date: d.date, sqz: candleInd.sqz[i] ?? 0 })),
    [ohlcData, candleInd.sqz]
  );

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-3 pb-2 border-b border-border/30 space-y-2">

        {/* Row 1: mode toggle + timeframes */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex bg-muted/40 rounded-lg p-0.5 shrink-0">
            {(['line','candles'] as ChartMode[]).map(m => (
              <Button key={m} variant="ghost" size="sm" onClick={() => setChartMode(m)}
                className={`h-6 px-2 text-[10px] rounded-md ${displayMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'candles' ? t('chart.candles') : t('chart.line')}
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

        {/* Row 2: indicator toggles */}
        {displayMode === 'candles' && (
          <div className="flex gap-1.5 items-center">
            {([
              { key: 'EMA(50)', active: showEMA, toggle: () => setShowEMA(v => !v), cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
              { key: 'BB',  active: showBB,  toggle: () => setShowBB(v => !v),  cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
              { key: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(v => !v), cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
            ] as const).map(({ key, active, toggle, cls }) => (
              <Button key={key} variant="outline" size="sm" onClick={toggle}
                className={`h-6 px-2 text-[10px] transition-colors ${active ? cls : 'text-muted-foreground border-border/50'}`}>
                {key}
              </Button>
            ))}
            <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono">
              {ohlcData.length}v
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

        {/* ── LINE MODE ──────────────────────────────────────────────── */}
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

        {/* ── CANDLES MODE ────────────────────────────────────────────── */}
        {displayMode === 'candles' && (
          <>
            {/* Wrapper is relative so CandleCanvas can overlay absolutely */}
            <div style={{ height: candleH }} className="w-full pt-3 pr-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={4}
                    interval="preserveStartEnd" />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false}
                    tickFormatter={formatY} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    orientation="right" width={54} />
                  {/* Transparent line anchors recharts tooltip hit-area to candle data */}
                  <Tooltip content={<CandleTooltip />} />
                  <Line dataKey="close" stroke="transparent" dot={false}
                    legendType="none" isAnimationActive={false} />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--primary))" strokeWidth={1.5}
                    strokeDasharray="5 3" opacity={0.85}
                    label={<PriceLabel price={asset.price} />} />
                  {asset.upperZoneLevels?.map((lv, i) => (
                    <ReferenceLine key={`uc${i}`} y={lv.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {asset.lowerZoneLevels?.map((lv, i) => (
                    <ReferenceLine key={`lc${i}`} y={lv.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Canvas overlay — candles + EMA + BB painted on top */}
              <CandleCanvas
                data={ohlcData}
                yMin={ohlcMin}
                yMax={ohlcMax}
                mt={8} mr={58} mb={28}
                showEMA={showEMA} ema={candleInd.ema}
                showBB={showBB}   bbUpper={candleInd.bbU} bbLower={candleInd.bbL}
              />
            </div>

            {/* SQZ sub-panel — standard recharts Bar (no Customized) */}
            {showSQZ && (
              <div style={{ height: sqzH }} className="w-full pb-2 pr-[58px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sqzBarData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <ReferenceLine y={0} stroke="hsl(var(--border))" opacity={0.5} />
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
