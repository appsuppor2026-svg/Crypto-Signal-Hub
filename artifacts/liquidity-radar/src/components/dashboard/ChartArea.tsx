import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AssetData } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ChartAreaProps {
  asset: AssetData;
}

export function ChartArea({ asset }: ChartAreaProps) {
  const isPositive = asset.change24h >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  
  // Format price for Y-axis based on magnitude
  const formatYAxis = (tickItem: number) => {
    if (tickItem > 1000) {
      return `$${(tickItem / 1000).toFixed(0)}k`;
    }
    return `$${tickItem.toFixed(2)}`;
  };

  const min = Math.min(...asset.chartData.map(d => d.price));
  const max = Math.max(...asset.chartData.map(d => d.price));
  const padding = (max - min) * 0.1;

  return (
    <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-lg">
      <CardContent className="p-0">
        <div className="h-[200px] w-full pt-4 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={asset.chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis 
                domain={[min - padding, max + padding]} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-mono)'
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={strokeColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
