import { useLocation } from 'wouter';
import { Home, Swords, Settings, BrainCircuit } from 'lucide-react';
import { useTranslation } from '@/i18n';

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/',        icon: Home,          label: t('nav.dashboard') },
    { path: '/markets', icon: Swords,         label: t('nav.markets')   },
    { path: '/ai',      icon: BrainCircuit,  label: t('nav.ai')        },
    { path: '/settings',icon: Settings,       label: t('nav.settings')  },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex justify-around items-center pb-safe">
      <div className="max-w-[430px] w-full mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location === item.path;
          const isAI     = item.path === '/ai';

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                {isAI && isActive ? (
                  <div className="relative">
                    <Icon size={22} className="stroke-[2.5px]" />
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_1px_var(--color-primary)]" />
                  </div>
                ) : (
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                )}
                {isActive && !isAI && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_1px_var(--color-primary)]" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isAI ? 'font-bold tracking-wider' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
