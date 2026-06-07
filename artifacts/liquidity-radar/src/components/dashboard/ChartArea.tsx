import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetData } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { Button } from '@/components/ui/button';

interface ChartAreaProps {
  asset: AssetData;
}

export function ChartArea({ asset }: ChartAreaProps) {
  const isPositive = asset.change24h >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  
  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000) {
      return `$${(tickItem / 1000).toFixed(1)}k`;
    }
    return `$${tickItem.toFixed(2)}`;
  };

  const min = Math.min(...asset.chartData.map(d => d.price));
  const max = Math.max(...asset.chartData.map(d => d.price));
  const padding = (max - min) * 0.15;
  const domainMin = min - padding;
  const domainMax = max + padding;

  return (
    <Card className="bg-[#0a0a0a] border-border rounded-2xl overflow-hidden shadow-xl">
      <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between border-b border-border/30 space-y-0">
        <CardTitle className="text-sm font-medium text-foreground">Precio 7D</CardTitle>
        <div className="flex space-x-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" disabled>1D</Button>
          <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px] font-bold bg-primary/20 text-primary">7D</Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" disabled>1M</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="h-[280px] w-full pt-4 pr-1 pl-0 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={asset.chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
                formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2 })}`, 'Price']}
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
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
