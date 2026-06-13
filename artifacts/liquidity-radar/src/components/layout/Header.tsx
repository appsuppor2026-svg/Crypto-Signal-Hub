import { useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { useAsset } from '@/context/AssetContext';
import { useAlerts } from '@/context/AlertsContext';
import { PriceAlertsSheet } from '@/components/modals/PriceAlertsSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { selectedAsset, setSelectedAsset } = useAsset();
  const { alerts } = useAlerts();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const availableAssets = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE'];

  // Badge only when there's a freshly triggered alert (triggered in the last 10 minutes)
  const recentlyTriggered = alerts.some(
    a => a.triggered && a.triggeredAt && Date.now() - a.triggeredAt < 10 * 60 * 1000
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border h-14">
      <div className="max-w-[430px] w-full mx-auto h-full px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_0_var(--color-primary)]/20">
            <div className="w-4 h-4 rounded-full border-[2px] border-primary" />
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-bold text-sm font-mono text-foreground tracking-tight">LRC</span>
            <span className="text-[8px] text-muted-foreground font-sans tracking-wide">Liquidity Radar Crypto</span>
          </div>
          <div className="flex sm:hidden flex-col leading-tight">
            <span className="font-bold text-xs font-mono text-foreground tracking-tight">LRC</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center space-x-1 bg-card border border-border px-3 py-1.5 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50">
              <span className="font-mono font-bold text-sm">{selectedAsset}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              {availableAssets.map((asset) => (
                <DropdownMenuItem
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`font-mono font-medium ${selectedAsset === asset ? 'text-primary' : 'text-foreground'}`}
                >
                  {asset}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setAlertsOpen(true)}
            className="relative text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <Bell size={20} className={recentlyTriggered ? 'text-destructive animate-[wiggle_0.4s_ease-in-out_2]' : ''} />
            {recentlyTriggered && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-destructive rounded-full border border-background shadow-[0_0_6px_0_rgba(239,68,68,0.8)] animate-pulse" />
            )}
          </button>
        </div>
      </div>
      <PriceAlertsSheet open={alertsOpen} onOpenChange={setAlertsOpen} />
    </header>
  );
}
