import { useLocation } from 'wouter';
import { Home, Swords, Settings, BrainCircuit } from 'lucide-react';
import { useTranslation } from '@/i18n';

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/',         icon: Home,         label: t('nav.dashboard') },
    { path: '/markets',  icon: Swords,        label: t('nav.markets')   },
    { path: '/ai',       icon: BrainCircuit,  label: t('nav.ai')        },
    { path: '/settings', icon: Settings,      label: t('nav.settings')  },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border flex justify-around items-center pb-safe">
      <div className="max-w-[430px] w-full mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location === item.path;
          const isAI     = item.path === '/ai';

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
                isAI
                  ? isActive ? 'text-violet-400' : 'text-muted-foreground hover:text-violet-400/60'
                  : isActive ? 'text-primary'    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                {isAI && isActive ? (
                  <>
                    <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-md scale-150" />
                    <Icon size={22} className="relative stroke-[2.5px] text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                    <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                  </>
                ) : (
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                )}
                {isActive && !isAI && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_1px_var(--color-primary)]" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isAI && isActive ? 'font-bold text-violet-300' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
