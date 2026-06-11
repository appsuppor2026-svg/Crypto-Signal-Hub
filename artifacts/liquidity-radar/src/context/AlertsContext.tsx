import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lr_price_alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch {}
  }, []);

  const saveAlerts = (newAlerts: PriceAlert[]) => {
    setAlerts(newAlerts);
    localStorage.setItem('lr_price_alerts', JSON.stringify(newAlerts));
  };

  const addAlert = (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => {
    const newAlert: PriceAlert = {
      ...alert,
      id: Math.random().toString(36).substring(7),
      createdAt: Date.now(),
      triggered: false,
    };
    saveAlerts([...alerts, newAlert]);
  };

  const removeAlert = (id: string) => {
    saveAlerts(alerts.filter(a => a.id !== id));
  };

  const markTriggered = (id: string) => {
    saveAlerts(alerts.map(a => a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a));
  };

  const checkAlerts = (symbol: string, price: number) => {
    const untriggered = alerts.filter(a => a.symbol === symbol && !a.triggered);
    untriggered.forEach(alert => {
      let shouldTrigger = false;
      if (alert.condition === 'above' && price >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && price <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        markTriggered(alert.id);
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Alerta de Precio', {
              body: `${alert.symbol} ha cruzado ${alert.targetPrice}`
            });
          } catch (e) {}
        }
      }
    });
  };

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, removeAlert, markTriggered, checkAlerts }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) throw new Error('useAlerts must be used within AlertsProvider');
  return context;
};
