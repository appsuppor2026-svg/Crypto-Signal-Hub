import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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

export interface SmartAlertPrefs {
  radarHigh: boolean;
  radarLow: boolean;
  biasChange: boolean;
  upperLiq200M: boolean;
  lowerLiq200M: boolean;
}

export interface AssetSnapshot {
  symbol: string;
  radarScore: number;
  bias: 'bullish' | 'neutral' | 'bearish';
  upperZoneAmount: string;
  lowerZoneAmount: string;
}

export interface SmartAlertFired {
  title: string;
  body: string;
}

const DEFAULT_SMART_PREFS: SmartAlertPrefs = {
  radarHigh: false,
  radarLow: false,
  biasChange: false,
  upperLiq200M: false,
  lowerLiq200M: false,
};

function parseMillions(amount: string): number {
  const clean = amount.replace(/[$,\s]/g, '').toUpperCase();
  if (clean.endsWith('B')) return parseFloat(clean) * 1_000;
  if (clean.endsWith('M')) return parseFloat(clean);
  if (clean.endsWith('K')) return parseFloat(clean) / 1_000;
  return parseFloat(clean) / 1_000_000 || 0;
}

const SMART_COOLDOWN_MS = 5 * 60 * 1000;

interface AlertsContextType {
  alerts: PriceAlert[];
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  removeAlert: (id: string) => void;
  markTriggered: (id: string) => void;
  checkAlerts: (symbol: string, price: number) => void;
  notificationPermission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  smartPrefs: SmartAlertPrefs;
  toggleSmartPref: (key: keyof SmartAlertPrefs) => void;
  checkSmartAlerts: (prev: AssetSnapshot | null, curr: AssetSnapshot) => SmartAlertFired[];
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [smartPrefs, setSmartPrefs] = useState<SmartAlertPrefs>(() => {
    try {
      const saved = localStorage.getItem('lr_smart_alert_prefs');
      if (saved) return { ...DEFAULT_SMART_PREFS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SMART_PREFS;
  });
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const smartPrefsRef = useRef(smartPrefs);
  useEffect(() => { smartPrefsRef.current = smartPrefs; }, [smartPrefs]);

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

  const toggleSmartPref = useCallback((key: keyof SmartAlertPrefs) => {
    setSmartPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('lr_smart_alert_prefs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const checkSmartAlerts = useCallback((
    prev: AssetSnapshot | null,
    curr: AssetSnapshot
  ): SmartAlertFired[] => {
    const prefs = smartPrefsRef.current;
    const fired: SmartAlertFired[] = [];
    const now = Date.now();

    const canFire = (key: string): boolean => {
      const cdKey = `${curr.symbol}:${key}`;
      const last = cooldownRef.current.get(cdKey) ?? 0;
      if (now - last < SMART_COOLDOWN_MS) return false;
      cooldownRef.current.set(cdKey, now);
      return true;
    };

    if (prefs.radarHigh && curr.radarScore > 80) {
      const wasBelow = prev === null || prev.radarScore <= 80;
      if (wasBelow && canFire('radarHigh')) {
        fired.push({
          title: `📡 ${curr.symbol} · Radar Score Alto`,
          body: `Radar Score ${curr.radarScore} > 80 — condiciones alcistas extremas`,
        });
      }
    }

    if (prefs.radarLow && curr.radarScore < 20) {
      const wasAbove = prev === null || prev.radarScore >= 20;
      if (wasAbove && canFire('radarLow')) {
        fired.push({
          title: `📡 ${curr.symbol} · Radar Score Bajo`,
          body: `Radar Score ${curr.radarScore} < 20 — condiciones bajistas extremas`,
        });
      }
    }

    if (prefs.biasChange && prev !== null && prev.bias !== curr.bias) {
      const label = (b: string) =>
        b === 'bullish' ? '🟢 Alcista' : b === 'bearish' ? '🔴 Bajista' : '⚪ Neutral';
      if (canFire('biasChange')) {
        fired.push({
          title: `🔄 ${curr.symbol} · Cambio de Sesgo`,
          body: `${label(prev.bias)} → ${label(curr.bias)}`,
        });
      }
    }

    if (prefs.upperLiq200M) {
      const currM = parseMillions(curr.upperZoneAmount);
      const prevM = prev ? parseMillions(prev.upperZoneAmount) : 0;
      if (currM > 200 && (prev === null || prevM <= 200) && canFire('upperLiq200M')) {
        fired.push({
          title: `💧 ${curr.symbol} · Liquidez Superior`,
          body: `Zona de liquidez superior ${curr.upperZoneAmount} > $200M detectada`,
        });
      }
    }

    if (prefs.lowerLiq200M) {
      const currM = parseMillions(curr.lowerZoneAmount);
      const prevM = prev ? parseMillions(prev.lowerZoneAmount) : 0;
      if (currM > 200 && (prev === null || prevM <= 200) && canFire('lowerLiq200M')) {
        fired.push({
          title: `💧 ${curr.symbol} · Liquidez Inferior`,
          body: `Zona de liquidez inferior ${curr.lowerZoneAmount} > $200M detectada`,
        });
      }
    }

    fired.forEach(({ title, body }) => {
      showNotificationViaRegistration(title, body).catch(() => {});
    });

    return fired;
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
      smartPrefs, toggleSmartPref, checkSmartAlerts,
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
