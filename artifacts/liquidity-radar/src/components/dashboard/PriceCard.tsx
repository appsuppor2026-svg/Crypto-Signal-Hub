import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AssetData } from '@/types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SiBitcoin, SiXrp } from 'react-icons/si';

interface PriceCardProps {
  asset: AssetData;
}

export function PriceCard({ asset }: PriceCardProps) {
  const isPositive = asset.change24h >= 0;
  
  const renderIcon = () => {
    switch(asset.symbol) {
      case 'BTC': return <SiBitcoin size={24} className="text-[#F7931A]" />;
      case 'XRP': return <SiXrp size={24} className="text-foreground" />;
      default: return <div className="w-6 h-6 rounded-full bg-muted" />;
    }
  };

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: asset.price < 1 ? 4 : 2,
    maximumFractionDigits: asset.price < 1 ? 4 : 2,
  }).format(asset.price);

  const formattedChange = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
  }).format(asset.change24h);

  return (
    <Card className="bg-card border-none rounded-2xl overflow-hidden relative shadow-lg">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-background rounded-full border border-border">
              {renderIcon()}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-none">{asset.symbol}</h3>
              <p className="text-xs text-muted-foreground">{asset.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium px-2 py-1 bg-secondary/20 text-secondary rounded-full border border-secondary/20">
              Live
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-4xl font-bold font-mono tracking-tighter">
            {formattedPrice}
          </span>
          <div className={`flex items-center mt-1 font-mono text-sm font-medium ${isPositive ? 'text-green-500' : 'text-destructive'}`}>
            {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            {formattedChange} ({isPositive ? '+' : ''}{asset.changePercent24h.toFixed(2)}%)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
