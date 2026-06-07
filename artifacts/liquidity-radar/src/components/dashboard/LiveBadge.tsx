import { DataStatus } from '@/hooks/useAssetData';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';

interface LiveBadgeProps {
  status: DataStatus;
}

export function LiveBadge({ status }: LiveBadgeProps) {
  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-1.5 text-muted-foreground text-xs font-mono">
        <Loader2 size={12} className="animate-spin" />
        <span>Conectando a datos en tiempo real...</span>
      </div>
    );
  }

  if (status === 'mock') {
    return (
      <div className="flex items-center space-x-1.5 text-yellow-500/80 text-xs font-mono">
        <WifiOff size={12} />
        <span>Datos de demostración (sin conexión)</span>
      </div>
    );
  }

  if (status === 'polling') {
    return (
      <div className="flex items-center space-x-1.5 text-blue-400/80 text-xs font-mono">
        <RefreshCw size={12} />
        <span>Precio actualizado · CoinGecko (cada 30s)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1.5 text-primary/80 text-xs font-mono">
      <Wifi size={12} />
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Precio en tiempo real · Kraken
      </span>
    </div>
  );
}
