import { DataStatus } from '@/hooks/useAssetData';
import { useTranslation } from '@/i18n';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';

interface LiveBadgeProps {
  status: DataStatus;
}

export function LiveBadge({ status }: LiveBadgeProps) {
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-1.5 text-muted-foreground text-xs font-mono">
        <Loader2 size={12} className="animate-spin" />
        <span>{t('livedata.connecting')}</span>
      </div>
    );
  }

  if (status === 'mock') {
    return (
      <div className="flex items-center space-x-1.5 text-yellow-500/80 text-xs font-mono">
        <WifiOff size={12} />
        <span>{t('livedata.demo')}</span>
      </div>
    );
  }

  if (status === 'polling') {
    return (
      <div className="flex items-center space-x-1.5 text-blue-400/80 text-xs font-mono">
        <RefreshCw size={12} />
        <span>{t('livedata.polling')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1.5 text-primary/80 text-xs font-mono">
      <Wifi size={12} />
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        {t('livedata.realtime')}
      </span>
    </div>
  );
}
