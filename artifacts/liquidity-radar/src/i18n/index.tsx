import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'es' | 'en';

const translations = {
  es: {
    'app.title': 'Liquidity Radar',
    'nav.dashboard': 'Dashboard',
    'nav.markets': 'Arena',
    'nav.ai': 'IA',
    'nav.settings': 'Ajustes',
    'bias.bullish': 'ALCISTA',
    'bias.neutral': 'NEUTRAL',
    'bias.bearish': 'BAJISTA',
    'metrics.liquidity': 'Liquidez',
    'metrics.openInterest': 'Interés Abierto',
    'metrics.funding': 'Fondeo',
    'metrics.trend': 'Tendencia',
    'zones.upper': 'LIQUIDEZ SUPERIOR',
    'zones.lower': 'LIQUIDEZ INFERIOR',
    'zones.target': 'Objetivo de Liquidez',
    'zones.targetDesc': 'Zona con mayor concentración de liquidez',
    'alerts.title': 'Señales Activas',
    'alerts.noSignals': 'Sin señales activas para este activo.',
    'alerts.nearMajorZone': 'está cerca de una zona de liquidez mayor',
    'alerts.clusterNear': 'se acerca a un clúster de liquidaciones',
    'alerts.supportDetected': 'Zona de soporte fuerte detectada en',
    'alerts.agoMin': 'Hace 5 min',
    'alerts.ago12min': 'Hace 12 min',
    'alerts.agoHour': 'Hace 1 hora',
    'livedata.realtime': 'Precio en tiempo real',
    'livedata.polling': 'Precio actualizado · CoinGecko (cada 30s)',
    'livedata.connecting': 'Conectando a datos en tiempo real...',
    'livedata.demo': 'Datos de demostración (sin conexión)',
    'disclaimer.text': 'Liquidity Radar Crypto provee información de mercado y herramientas de análisis únicamente. No es asesoramiento financiero. Los usuarios son responsables de sus propias decisiones de inversión.',
    'settings.title': 'Ajustes',
    'settings.language': 'Idioma',
    'coming.soon': 'Próximamente',
  },
  en: {
    'app.title': 'Liquidity Radar',
    'nav.dashboard': 'Dashboard',
    'nav.markets': 'Arena',
    'nav.ai': 'AI',
    'nav.settings': 'Settings',
    'bias.bullish': 'BULLISH',
    'bias.neutral': 'NEUTRAL',
    'bias.bearish': 'BEARISH',
    'metrics.liquidity': 'Liquidity',
    'metrics.openInterest': 'Open Interest',
    'metrics.funding': 'Funding',
    'metrics.trend': 'Trend',
    'zones.upper': 'UPPER LIQUIDITY',
    'zones.lower': 'LOWER LIQUIDITY',
    'zones.target': 'Liquidity Target',
    'zones.targetDesc': 'Highest liquidity concentration zone',
    'alerts.title': 'Active Signals',
    'alerts.noSignals': 'No active signals for this asset.',
    'alerts.nearMajorZone': 'is near a major liquidity zone',
    'alerts.clusterNear': 'approaching a liquidation cluster',
    'alerts.supportDetected': 'Strong support zone detected at',
    'alerts.agoMin': '5 min ago',
    'alerts.ago12min': '12 min ago',
    'alerts.agoHour': '1 hour ago',
    'livedata.realtime': 'Real-time price',
    'livedata.polling': 'Price updated · CoinGecko (every 30s)',
    'livedata.connecting': 'Connecting to live data...',
    'livedata.demo': 'Demo data (offline)',
    'disclaimer.text': 'Liquidity Radar Crypto provides market information and analysis tools only. It is not financial advice. Users are responsible for their own investment decisions.',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'coming.soon': 'Coming Soon',
  }
};

type TranslationsContextType = {
  t: (key: keyof typeof translations['es']) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
};

const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lr_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.language === 'en' || parsed.language === 'es') {
          setLanguage(parsed.language);
        }
      }
    } catch {}
  }, []);

  const t = (key: keyof typeof translations['es']) => {
    return translations[language][key] || translations['es'][key] || key;
  };

  return (
    <TranslationsContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(TranslationsContext);
  if (!ctx) throw new Error('useTranslation must be used within TranslationsProvider');
  return ctx;
}
