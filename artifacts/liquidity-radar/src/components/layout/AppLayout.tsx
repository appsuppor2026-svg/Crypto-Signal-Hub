import React, { useEffect } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Force dark mode on document element
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col md:bg-black/90">
      <div className="w-full max-w-[430px] mx-auto min-h-[100dvh] bg-background relative flex flex-col shadow-2xl overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 scrollbar-none">
          {children}
        </main>
        
        <BottomNav />
      </div>
    </div>
  );
}
