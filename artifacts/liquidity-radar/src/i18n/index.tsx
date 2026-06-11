import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'es' | 'en';

const translations = {
  es: {
    'app.title': 'Liquidity Radar',
    'nav.dashboard': 'Dashboard',
    'nav.markets': 'Mercados',
    'nav.portfolio': 'Portafolio',
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
    'alerts.title': 'Señales Activas',
    'disclaimer.text': 'Liquidity Radar Crypto provee información de mercado y herramientas de análisis únicamente. No es asesoramiento financiero. Los usuarios son responsables de sus propias decisiones de inversión.',
    'settings.title': 'Ajustes',
    'settings.language': 'Idioma',
    'coming.soon': 'Próximamente',
  },
  en: {
    'app.title': 'Liquidity Radar',
    'nav.dashboard': 'Dashboard',
    'nav.markets': 'Markets',
    'nav.portfolio': 'Portfolio',
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
    'alerts.title': 'Active Signals',
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

export const useTranslation = () => {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationsProvider');
  }
  return context;
};
