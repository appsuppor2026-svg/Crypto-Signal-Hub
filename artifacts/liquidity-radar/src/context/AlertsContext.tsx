import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  registerSW,
  syncAlertsToSW,
  onAlertTriggered,
  requestNotificationPermission,
  getNotificationPermission,
  showNotificationViaRegistration,
} from '@/services/swService';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

interface AlertsContextType {
  alerts: PriceAlert[];
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  removeAlert: (id: string) => void;
  markTriggered: (id: string) => void;
  checkAlerts: (symbol: string, price: number) => void;
  notificationPermission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lr_price_alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch {}

    registerSW().then(() => {
      const saved = localStorage.getItem('lr_price_alerts');
      if (saved) {
        try { syncAlertsToSW(JSON.parse(saved)); } catch {}
      }
    });

    const unsubscribe = onAlertTriggered((alertId) => {
      setAlerts(prev => {
        const updated = prev.map(a =>
          a.id === alertId ? { ...a, triggered: true, triggeredAt: Date.now() } : a
        );
        localStorage.setItem('lr_price_alerts', JSON.stringify(updated));
        return updated;
      });
    });

    return unsubscribe;
  }, []);

  const saveAlerts = useCallback((newAlerts: PriceAlert[]) => {
    setAlerts(newAlerts);
    localStorage.setItem('lr_price_alerts', JSON.stringify(newAlerts));
    syncAlertsToSW(newAlerts).catch(() => {});
  }, []);

  const addAlert = useCallback((alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => {
    setAlerts(prev => {
      const newAlert: PriceAlert = {
        ...alert,
        id: Math.random().toString(36).substring(7),
        createdAt: Date.now(),
        triggered: false,
      };
      const updated = [...prev, newAlert];
      localStorage.setItem('lr_price_alerts', JSON.stringify(updated));
      syncAlertsToSW(updated).catch(() => {});
      return updated;
    });
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem('lr_price_alerts', JSON.stringify(updated));
      syncAlertsToSW(updated).catch(() => {});
      return updated;
    });
  }, []);

  const markTriggered = useCallback((id: string) => {
    setAlerts(prev => {
      const updated = prev.map(a =>
        a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a
      );
      localStorage.setItem('lr_price_alerts', JSON.stringify(updated));
      syncAlertsToSW(updated).catch(() => {});
      return updated;
    });
  }, []);

  const checkAlerts = useCallback((symbol: string, price: number) => {
    setAlerts(prev => {
      const untriggered = prev.filter(a => a.symbol === symbol && !a.triggered);
      if (untriggered.length === 0) return prev;

      let changed = false;
      const updated = prev.map(alert => {
        if (alert.symbol !== symbol || alert.triggered) return alert;

        let shouldTrigger = false;
        if (alert.condition === 'above' && price >= alert.targetPrice) shouldTrigger = true;
        if (alert.condition === 'below' && price <= alert.targetPrice) shouldTrigger = true;

        if (shouldTrigger) {
          changed = true;
          const conditionText = alert.condition === 'above' ? 'superó' : 'cayó por debajo de';
          const priceFormatted = alert.targetPrice >= 1
            ? `$${alert.targetPrice.toLocaleString('es-ES')}`
            : `$${alert.targetPrice.toFixed(4)}`;

          showNotificationViaRegistration(
            `🚨 Alerta: ${alert.symbol}`,
            `${alert.symbol} ${conditionText} ${priceFormatted}`
          ).catch(() => {});

          return { ...alert, triggered: true, triggeredAt: Date.now() };
        }
        return alert;
      });

      if (changed) {
        localStorage.setItem('lr_price_alerts', JSON.stringify(updated));
        syncAlertsToSW(updated).catch(() => {});
        return updated;
      }
      return prev;
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
    return result;
  }, []);

  return (
    <AlertsContext.Provider value={{
      alerts, addAlert, removeAlert, markTriggered, checkAlerts,
      notificationPermission, requestPermission,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) throw new Error('useAlerts must be used within AlertsProvider');
  return context;
};
