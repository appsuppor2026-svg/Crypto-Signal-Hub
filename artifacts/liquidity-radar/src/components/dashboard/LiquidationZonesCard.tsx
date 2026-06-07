import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AssetData } from '@/types';
import { useTranslation } from '@/i18n';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface LiquidationZonesCardProps {
  asset: AssetData;
}

export function LiquidationZonesCard({ asset }: LiquidationZonesCardProps) {
  const { t } = useTranslation();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price < 1 ? 4 : 0,
      maximumFractionDigits: price < 1 ? 4 : 0,
    }).format(price);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-card border-border rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-16 h-16 bg-destructive/10 rounded-full blur-xl -mr-4 -mt-4 transition-all group-hover:bg-destructive/20" />
        <CardContent className="p-4 flex flex-col h-full justify-between relative z-10">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle size={14} />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('zones.upper')}</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-destructive">{formatPrice(asset.upperZone.price)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Vol: <span className="text-foreground font-mono">{asset.upperZone.amount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-xl relative overflow-hidden group">
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-green-500/10 rounded-full blur-xl -mr-4 -mb-4 transition-all group-hover:bg-green-500/20" />
        <CardContent className="p-4 flex flex-col h-full justify-between relative z-10">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 rounded-md bg-green-500/10 text-green-500">
              <ShieldCheck size={14} />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('zones.lower')}</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-green-500">{formatPrice(asset.lowerZone.price)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Vol: <span className="text-foreground font-mono">{asset.lowerZone.amount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
