import { Card, CardContent } from '@/components/ui/card';
import { AssetData } from '@/types';
import { useTranslation } from '@/i18n';
import { Flame, ShieldCheck } from 'lucide-react';

interface LiquidationZonesCardProps {
  asset: AssetData;
}

export function LiquidationZonesCard({ asset }: LiquidationZonesCardProps) {
  const { t } = useTranslation();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 4 : 2,
    }).format(price);
  };

  const getAmountNum = (amountStr: string) => {
    return parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
  };

  const maxUpper = Math.max(...(asset.upperZoneLevels?.map(l => getAmountNum(l.amount)) || [1]));
  const maxLower = Math.max(...(asset.lowerZoneLevels?.map(l => getAmountNum(l.amount)) || [1]));

  return (
    <div className="flex flex-col space-y-4">
      {/* Upper Liquidity */}
      <Card className="bg-card border-border rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-3xl -mr-10 -mt-10" />
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
                <Flame size={16} />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('zones.upper')}
              </span>
            </div>
            <div className="px-2 py-0.5 rounded bg-muted text-[10px] font-mono font-medium">
              Total: {asset.upperZone?.amount || '0M'}
            </div>
          </div>

          <div className="space-y-3">
            {asset.upperZoneLevels?.map((level, idx) => {
              const amountNum = getAmountNum(level.amount);
              const percent = (amountNum / maxUpper) * 100;
              const isMax = amountNum === maxUpper;
              return (
                <div key={idx} className={`flex items-center justify-between ${isMax ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <span className="font-mono text-sm w-24">{formatPrice(level.price)}</span>
                  <div className="flex-1 mx-3 h-2 bg-background rounded-full overflow-hidden border border-border/30">
                    <div className={`h-full ${isMax ? 'bg-destructive' : 'bg-destructive/50'}`} style={{ width: `${percent}%` }} />
                  </div>
                  <span className="font-mono text-sm w-12 text-right">{level.amount}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lower Liquidity */}
      <Card className="bg-card border-border rounded-xl relative overflow-hidden group">
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-10 -mb-10" />
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-md bg-green-500/10 text-green-500">
                <ShieldCheck size={16} />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('zones.lower')}
              </span>
            </div>
            <div className="px-2 py-0.5 rounded bg-muted text-[10px] font-mono font-medium">
              Total: {asset.lowerZone?.amount || '0M'}
            </div>
          </div>

          <div className="space-y-3">
            {asset.lowerZoneLevels?.map((level, idx) => {
              const amountNum = getAmountNum(level.amount);
              const percent = (amountNum / maxLower) * 100;
              const isMax = amountNum === maxLower;
              return (
                <div key={idx} className={`flex items-center justify-between ${isMax ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <span className="font-mono text-sm w-24">{formatPrice(level.price)}</span>
                  <div className="flex-1 mx-3 h-2 bg-background rounded-full overflow-hidden border border-border/30">
                    <div className={`h-full ${isMax ? 'bg-green-500' : 'bg-green-500/50'}`} style={{ width: `${percent}%` }} />
                  </div>
                  <span className="font-mono text-sm w-12 text-right">{level.amount}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
