import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      {(data as OHLCPoint[]).map((point, i) => {
        const x0 = xScale(point.date);
        if (x0 == null) return null;
        const cx = x0 + bandwidth / 2;
        const candleW = Math.max(bandwidth * 0.65, 2);

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
  if (!d) return null;
  const isGreen = d.close >= d.open;
  const fmt = (v: number) =>
    v >= 1000
      ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${v.toFixed(4)}`;
  return (
    <div className="bg-black border border-border rounded-lg p-3 text-xs font-mono shadow-xl min-w-[160px]">
      <div className="text-muted-foreground mb-2 font-sans text-[10px]">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Open</span><span>{fmt(d.open)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">High</span><span className="text-green-400">{fmt(d.high)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Low</span><span className="text-red-400">{fmt(d.low)}</span></div>
        <div className={`flex justify-between gap-4 font-bold ${isGreen ? 'text-green-400' : 'text-red-400'}`}>
          <span>Close</span><span>{fmt(d.close)}</span>
        </div>
      </div>
    </div>
  );
};

export function ChartArea({ asset }: ChartAreaProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('7D');
  const [chartMode, setChartMode] = useState<ChartMode>('line');
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
      if (chartMode === 'line') {
        const data = await fetchChartDataByTimeframe(asset.symbol, selectedTimeframe);
        if (mounted && data.length > 0) setChartData(data);
      } else {
        const data = await fetchOHLCData(asset.symbol, selectedTimeframe);
        if (mounted && data.length > 0) setOhlcData(data);
      }
      if (mounted) setIsLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [asset.symbol, selectedTimeframe, chartMode]);

  useEffect(() => {
    setSelectedTimeframe('7D');
    setOhlcData([]);
  }, [asset.symbol]);

  const isPositive = asset.change24h >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  const formatYAxis = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

  const enrichedLineData = useMemo(() => {
    if (!chartData.length) return [];
    const prices = chartData.map(d => d.price);
    const ema = showEMA ? calculateEMA(prices, Math.min(50, prices.length)) : [];
    const bb = showBB ? calculateBollingerBands(prices, 20) : [];
    const sqz = showSQZ ? calculateSqueezeMomentum(prices) : [];
    return chartData.map((point, i) => ({
      ...point,
      ema: showEMA ? (ema[i] ?? null) : undefined,
      bbUpper: showBB ? (bb[i]?.upper ?? null) : undefined,
      bbMiddle: showBB ? (bb[i]?.middle ?? null) : undefined,
      bbLower: showBB ? (bb[i]?.lower ?? null) : undefined,
      sqzMomentum: showSQZ ? (sqz[i]?.momentum ?? null) : undefined,
      sqzInSqueeze: showSQZ ? (sqz[i]?.inSqueeze ?? false) : undefined,
    }));
  }, [chartData, showEMA, showBB, showSQZ]);

  const lineMin = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0;
  const lineMax = chartData.length ? Math.max(...chartData.map(d => d.price)) : 0;
  const linePad = (lineMax - lineMin) * 0.15;

  const ohlcMin = ohlcData.length ? Math.min(...ohlcData.map(d => d.low)) * 0.998 : 0;
  const ohlcMax = ohlcData.length ? Math.max(...ohlcData.map(d => d.high)) * 1.002 : 0;

  const chartH = showSQZ && chartMode === 'line' ? 260 : 300;

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-4 pb-2 flex flex-col space-y-2 border-b border-border/30">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {chartMode === 'candles' ? '🕯 Velas' : '📈 Precio'} {selectedTimeframe}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex bg-muted/40 rounded-lg p-0.5 mr-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChartMode('line')}
                className={`h-6 px-2 text-[10px] rounded-md ${chartMode === 'line' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Línea
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChartMode('candles')}
                className={`h-6 px-2 text-[10px] rounded-md ${chartMode === 'candles' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                🕯 Velas
              </Button>
            </div>
            {(['1D', '7D', '1M'] as ChartTimeframe[]).map((tf) => (
              <Button
                key={tf}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTimeframe(tf)}
                className={`h-6 px-2 text-[10px] ${selectedTimeframe === tf ? 'bg-primary/20 text-primary border border-primary/30 font-bold' : 'text-muted-foreground'}`}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>

        {chartMode === 'line' && (
          <div className="flex flex-row items-center justify-start space-x-2 pt-0.5">
            {[
              { key: 'EMA', label: 'EMA 50', active: showEMA, toggle: () => setShowEMA(!showEMA), color: 'orange' },
              { key: 'BB', label: 'BB', active: showBB, toggle: () => setShowBB(!showBB), color: 'blue' },
              { key: 'SQZ', label: 'SQZ', active: showSQZ, toggle: () => setShowSQZ(!showSQZ), color: 'purple' },
            ].map(({ key, label, active, toggle, color }) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={toggle}
                className={`h-6 px-2 text-[10px] ${active
                  ? `bg-${color}-500/20 text-${color}-400 border-${color}-500/40`
                  : 'text-muted-foreground border-border/50'}`}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}

        {chartMode === 'line' ? (
          <>
            <div className={`w-full pt-4 pr-1 pl-0 pb-1`} style={{ height: chartH }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={enrichedLineData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPriceLR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={5} />
                  <YAxis domain={[lineMin - linePad, lineMax + linePad]} axisLine={false} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} orientation="right" width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontSize: '10px' }}
                    formatter={(value: any, name: string) => {
                      const fmt = (v: number) => `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: Number(v) < 1 ? 4 : 2 })}`;
                      if (name === 'price') return [fmt(value), 'Precio'];
                      if (name === 'ema') return [fmt(value), 'EMA 50'];
                      if (name === 'bbUpper') return [fmt(value), 'BB Superior'];
                      if (name === 'bbLower') return [fmt(value), 'BB Inferior'];
                      return [value, name];
                    }}
                  />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                  {asset.upperZoneLevels?.map((level, i) => (
                    <ReferenceLine key={`u-${i}`} y={level.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {asset.lowerZoneLevels?.map((level, i) => (
                    <ReferenceLine key={`l-${i}`} y={level.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2} fillOpacity={1} fill="url(#colorPriceLR)" isAnimationActive animationDuration={800} activeDot={{ r: 4, strokeWidth: 0, fill: strokeColor }} />
                  {showEMA && <Line type="monotone" dataKey="ema" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />}
                  {showBB && <>
                    <Line type="monotone" dataKey="bbUpper" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="bbMiddle" stroke="#3b82f6" strokeWidth={1} opacity={0.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="bbLower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} connectNulls />
                  </>}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {showSQZ && (
              <div className="w-full h-[56px] pb-2 pr-12">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrichedLineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="sqzMomentum">
                      {enrichedLineData.map((e, i) => (
                        <Cell key={i} fill={(e.sqzMomentum || 0) > 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                    <XAxis dataKey="date" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="w-full pt-4 pr-1 pl-0 pb-1" style={{ height: 320 }}>
            {ohlcData.length === 0 && !isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Sin datos de velas disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ohlcData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.25} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={5} />
                  <YAxis domain={[ohlcMin, ohlcMax]} axisLine={false} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} orientation="right" width={50} />
                  <Tooltip content={<CandleTooltip />} />
                  <ReferenceLine y={asset.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                  {asset.upperZoneLevels?.map((level, i) => (
                    <ReferenceLine key={`uc-${i}`} y={level.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {asset.lowerZoneLevels?.map((level, i) => (
                    <ReferenceLine key={`lc-${i}`} y={level.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
                  ))}
                  {/* Hidden line to anchor the Y scale for custom rendering */}
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
