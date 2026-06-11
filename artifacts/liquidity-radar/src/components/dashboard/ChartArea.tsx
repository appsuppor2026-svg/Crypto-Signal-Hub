import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetData } from '@/types';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, 
  ComposedChart, Line, BarChart, Bar, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartTimeframe, fetchChartDataByTimeframe, ChartPoint } from '@/services/cryptoService';
import { calculateEMA, calculateBollingerBands, calculateSqueezeMomentum } from '@/services/indicators';

interface ChartAreaProps {
  asset: AssetData;
}

export function ChartArea({ asset }: ChartAreaProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('7D');
  const [chartData, setChartData] = useState<ChartPoint[]>(asset.chartData);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showEMA, setShowEMA] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showSQZ, setShowSQZ] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchChartDataByTimeframe(asset.symbol, selectedTimeframe);
      if (mounted && data.length > 0) {
        setChartData(data);
      }
      if (mounted) setIsLoading(false);
    };
    loadData();
    return () => { mounted = false; };
  }, [asset.symbol, selectedTimeframe]);

  // When asset changes, reset to 7D
  useEffect(() => {
    setSelectedTimeframe('7D');
  }, [asset.symbol]);

  const isPositive = asset.change24h >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  
  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000) {
      return `$${(tickItem / 1000).toFixed(1)}k`;
    }
    return `$${tickItem.toFixed(2)}`;
  };

  const enrichedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    const prices = chartData.map(d => d.price);
    const ema = showEMA ? calculateEMA(prices, Math.min(50, prices.length)) : [];
    const bb = showBB ? calculateBollingerBands(prices, 20) : [];
    const sqz = showSQZ ? calculateSqueezeMomentum(prices, 20, 20) : [];

    return chartData.map((point, i) => ({
      ...point,
      ema: showEMA ? ema[i] : undefined,
      bbUpper: showBB ? bb[i]?.upper : undefined,
      bbMiddle: showBB ? bb[i]?.middle : undefined,
      bbLower: showBB ? bb[i]?.lower : undefined,
      sqzMomentum: showSQZ ? sqz[i]?.momentum : undefined,
      sqzInSqueeze: showSQZ ? sqz[i]?.inSqueeze : undefined,
    }));
  }, [chartData, showEMA, showBB, showSQZ]);

  const min = Math.min(...chartData.map(d => d.price));
  const max = Math.max(...chartData.map(d => d.price));
  const padding = (max - min) * 0.15;
  const domainMin = min - padding;
  const domainMax = max + padding;

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-4 pb-2 flex flex-col space-y-2 border-b border-border/30">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">Precio {selectedTimeframe}</CardTitle>
          <div className="flex space-x-1">
            {(['1D', '7D', '1M'] as ChartTimeframe[]).map((tf) => (
              <Button 
                key={tf}
                variant={selectedTimeframe === tf ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setSelectedTimeframe(tf)}
                className={`h-6 px-2 text-[10px] ${selectedTimeframe === tf ? 'font-bold bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground'}`}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-row items-center justify-start space-x-2 pt-1">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowEMA(!showEMA)}
            className={`h-6 px-2 text-[10px] ${showEMA ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' : 'text-muted-foreground'}`}
          >
            EMA 50
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowBB(!showBB)}
            className={`h-6 px-2 text-[10px] ${showBB ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' : 'text-muted-foreground'}`}
          >
            BB
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSQZ(!showSQZ)}
            className={`h-6 px-2 text-[10px] ${showSQZ ? 'bg-purple-500/20 text-purple-500 border-purple-500/50' : 'text-muted-foreground'}`}
          >
            SQZ
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="animate-pulse w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary" style={{ animationDuration: '1s' }} />
          </div>
        )}
        <div className={`w-full pt-4 pr-1 pl-0 pb-1 ${showSQZ ? 'h-[280px]' : 'h-[320px]'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enrichedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                dy={5}
              />
              <YAxis 
                domain={[domainMin, domainMax]} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                orientation="right"
                width={50}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#000', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                }}
                itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontSize: '10px' }}
                formatter={(value: any, name: string) => {
                  if (name === 'price') return [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: Number(value) < 1 ? 4 : 2, maximumFractionDigits: Number(value) < 1 ? 4 : 2 })}`, 'Price'];
                  if (name === 'ema') return [`$${Number(value).toFixed(2)}`, 'EMA 50'];
                  if (name === 'bbUpper') return [`$${Number(value).toFixed(2)}`, 'BB Upper'];
                  if (name === 'bbLower') return [`$${Number(value).toFixed(2)}`, 'BB Lower'];
                  return [value, name];
                }}
              />
              <ReferenceLine y={asset.price} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.6} />
              
              {asset.upperZoneLevels?.map((level, i) => (
                <ReferenceLine key={`upper-${i}`} y={level.price} stroke="#ef4444" strokeDasharray="2 4" opacity={0.2} />
              ))}
              {asset.lowerZoneLevels?.map((level, i) => (
                <ReferenceLine key={`lower-${i}`} y={level.price} stroke="#22c55e" strokeDasharray="2 4" opacity={0.2} />
              ))}

              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={strokeColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                isAnimationActive={true}
                animationDuration={800}
                activeDot={{ r: 4, strokeWidth: 0, fill: strokeColor, style: { filter: `drop-shadow(0px 0px 4px ${strokeColor})` } }}
              />

              {showEMA && (
                <Line type="monotone" dataKey="ema" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              )}
              {showBB && (
                <>
                  <Line type="monotone" dataKey="bbUpper" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="bbMiddle" stroke="#3b82f6" strokeWidth={1} opacity={0.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="bbLower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} dot={false} isAnimationActive={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {showSQZ && (
          <div className="w-full h-[60px] pb-2 pr-12 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrichedData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="sqzMomentum">
                  {enrichedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={(entry.sqzMomentum || 0) > 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
                <XAxis dataKey="date" hide />
                <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                <Bar dataKey="sqzInSqueeze" shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  if (payload.sqzInSqueeze === undefined) return null;
                  return (
                    <rect 
                      x={x + width/2 - 2} 
                      y={payload.sqzMomentum > 0 ? y - 6 : y + height + 2} 
                      width={4} 
                      height={4} 
                      fill={payload.sqzInSqueeze ? '#64748b' : '#06b6d4'} 
                    />
                  );
                }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
