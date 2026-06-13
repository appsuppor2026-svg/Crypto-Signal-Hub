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

// BTC orange
const BTC = '#f7931a';

function RadarIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="16" cy="16" r="13.5" stroke={BTC} strokeWidth="1" opacity="0.18" />
      {/* Mid ring */}
      <circle cx="16" cy="16" r="9" stroke={BTC} strokeWidth="1" opacity="0.38" />
      {/* Inner ring */}
      <circle cx="16" cy="16" r="4.5" stroke={BTC} strokeWidth="1" opacity="0.6" />
      {/* Crosshair lines (faint) */}
      <line x1="2.5" y1="16" x2="29.5" y2="16" stroke={BTC} strokeWidth="0.5" opacity="0.15" />
      <line x1="16" y1="2.5" x2="16" y2="29.5" stroke={BTC} strokeWidth="0.5" opacity="0.15" />
      {/* Radar sweep arm */}
      <line x1="16" y1="16" x2="27" y2="6.5" stroke={BTC} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      {/* Primary blip on arm */}
      <circle cx="22.5" cy="10.5" r="2.2" fill={BTC} opacity="0.95" />
      {/* Halo on blip */}
      <circle cx="22.5" cy="10.5" r="4" stroke={BTC} strokeWidth="0.8" opacity="0.35" />
      {/* Secondary faint blip */}
      <circle cx="13" cy="10" r="1.2" fill={BTC} opacity="0.5" />
      {/* Center dot */}
      <circle cx="16" cy="16" r="1.8" fill={BTC} />
    </svg>
  );
}

export function Header() {
  const { selectedAsset, setSelectedAsset } = useAsset();
  const { alerts } = useAlerts();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const availableAssets = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE'];

  const recentlyTriggered = alerts.some(
    a => a.triggered && a.triggeredAt && Date.now() - a.triggeredAt < 10 * 60 * 1000
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border h-14">
      <div className="max-w-[430px] w-full mx-auto h-full px-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: `rgba(247,147,26,0.08)`,
              border: `1px solid rgba(247,147,26,0.28)`,
              boxShadow: `0 0 14px 0 rgba(247,147,26,0.22)`,
            }}
          >
            <RadarIcon size={28} />
          </div>

          {/* Desktop: LRC + subtitle */}
          <div className="hidden sm:flex flex-col leading-tight">
            <span
              className="font-extrabold text-sm font-mono tracking-tight"
              style={{ color: BTC, textShadow: `0 0 12px rgba(247,147,26,0.5)` }}
            >
              LRC
            </span>
            <span className="text-[8px] text-muted-foreground font-sans tracking-wide">
              Liquidity Radar Crypto
            </span>
          </div>

          {/* Mobile: LRC only */}
          <div className="flex sm:hidden flex-col leading-tight">
            <span
              className="font-extrabold text-xs font-mono tracking-tight"
              style={{ color: BTC, textShadow: `0 0 10px rgba(247,147,26,0.5)` }}
            >
              LRC
            </span>
          </div>
        </div>

        {/* Right controls */}
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
