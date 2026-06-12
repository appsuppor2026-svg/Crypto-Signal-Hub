import React, { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { TranslationsProvider } from '@/i18n';
import { AssetProvider } from '@/context/AssetContext';
import { AlertsProvider } from '@/context/AlertsContext';
import { AppLayout } from '@/components/layout/AppLayout';

import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import Portfolio from "@/pages/Portfolio";
import AIAnalysis from "@/pages/AIAnalysis";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Support from "@/pages/Support";
import NotFound from "@/pages/not-found";
import { DisclaimerModal } from '@/components/modals/DisclaimerModal';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/markets" component={Markets} />
      <Route path="/ai" component={AIAnalysis} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={Profile} />
      <Route path="/support" component={Support} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem('lr_disclaimer_accepted');
    if (accepted !== 'true') {
      setDisclaimerAccepted(false);
    }
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('lr_disclaimer_accepted', 'true');
    setDisclaimerAccepted(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TranslationsProvider>
        <AssetProvider>
          <AlertsProvider>
            <TooltipProvider>
              {!disclaimerAccepted && (
                <DisclaimerModal onAccept={handleAcceptDisclaimer} />
              )}
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppLayout>
                  <Router />
                </AppLayout>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AlertsProvider>
        </AssetProvider>
      </TranslationsProvider>
    </QueryClientProvider>
  );
}

export default App;
