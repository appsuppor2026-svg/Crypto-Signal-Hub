import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/types';
import { useTranslation } from '@/i18n';
import { motion } from 'framer-motion';

interface ActiveAlertsCardProps {
  alerts: Alert[];
  selectedAsset: string;
}

export function ActiveAlertsCard({ alerts, selectedAsset }: ActiveAlertsCardProps) {
  const { t, language } = useTranslation();

  // Filter alerts by current asset
  const relevantAlerts = alerts.filter(a => a.asset === selectedAsset);

  return (
    <Card className="bg-card border-border rounded-2xl shadow-lg">
      <CardHeader className="pb-3 px-5 pt-5 border-b border-border/50">
        <CardTitle className="text-sm font-bold tracking-wide uppercase text-muted-foreground flex items-center">
          <div className="w-2 h-2 rounded-full bg-primary mr-2 shadow-[0_0_8px_0_var(--color-primary)] animate-pulse" />
          {t('alerts.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {relevantAlerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('alerts.noSignals')}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {relevantAlerts.map((alert, index) => (
              <AlertItem key={alert.id} alert={alert} index={index} language={language} t={t} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

function AlertItem({ alert, index, language, t }: { alert: Alert; index: number; language: string; t: TFn }) {
  const getPriorityColor = () => {
    switch (alert.priority) {
      case 'high':   return 'bg-destructive shadow-[0_0_8px_0_var(--color-destructive)]';
      case 'medium': return 'bg-yellow-500 shadow-[0_0_8px_0_rgba(234,179,8,0.6)]';
      case 'low':    return 'bg-green-500 shadow-[0_0_8px_0_rgba(34,197,94,0.6)]';
      default:       return 'bg-primary';
    }
  };

  // Build the display text using i18n keys when available
  const displayText = (() => {
    if (!alert.textKey) return language === 'en' ? (alert.textEn ?? alert.text) : alert.text;
    switch (alert.textKey) {
      case 'nearMajorZone':     return `${alert.asset} ${t('alerts.nearMajorZone')}`;
      case 'clusterNear':       return `${alert.asset} ${t('alerts.clusterNear')}`;
      case 'supportDetected':   return `${t('alerts.supportDetected')} ${alert.textParam ?? ''}`;
      default:                  return language === 'en' ? (alert.textEn ?? alert.text) : alert.text;
    }
  })();

  const displayTimestamp = (() => {
    switch (alert.timestampKey) {
      case 'agoMin':    return t('alerts.agoMin');
      case 'ago12min':  return t('alerts.ago12min');
      case 'agoHour':   return t('alerts.agoHour');
      default:          return alert.timestamp;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="p-4 flex items-start space-x-3 hover:bg-muted/50 transition-colors"
    >
      <div className="mt-1 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${getPriorityColor()}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{displayText}</p>
        <p className="text-xs text-muted-foreground mt-1.5 font-mono">{displayTimestamp}</p>
      </div>
    </motion.div>
  );
}
