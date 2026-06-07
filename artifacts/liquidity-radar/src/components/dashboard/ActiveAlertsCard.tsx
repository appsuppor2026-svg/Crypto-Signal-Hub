import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/types';
import { useTranslation } from '@/i18n';
import { motion } from 'framer-motion';

interface ActiveAlertsCardProps {
  alerts: Alert[];
  selectedAsset: string;
}

export function ActiveAlertsCard({ alerts, selectedAsset }: ActiveAlertsCardProps) {
  const { t } = useTranslation();
  
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
            No active signals for this asset.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {relevantAlerts.map((alert, index) => (
              <AlertItem key={alert.id} alert={alert} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert, index }: { alert: Alert; index: number }) {
  const getPriorityColor = () => {
    switch(alert.priority) {
      case 'high': return 'bg-destructive shadow-[0_0_8px_0_var(--color-destructive)]';
      case 'medium': return 'bg-yellow-500 shadow-[0_0_8px_0_rgba(234,179,8,0.6)]';
      case 'low': return 'bg-green-500 shadow-[0_0_8px_0_rgba(34,197,94,0.6)]';
      default: return 'bg-primary';
    }
  };

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
        <p className="text-sm font-medium leading-snug">{alert.text}</p>
        <p className="text-xs text-muted-foreground mt-1.5 font-mono">{alert.timestamp}</p>
      </div>
    </motion.div>
  );
}
