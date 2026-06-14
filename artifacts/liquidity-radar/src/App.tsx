import { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { TranslationsProvider } from '@/i18n';
import { AssetProvider } from '@/context/AssetContext';
import { AlertsProvider } from '@/context/AlertsContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { AppLayout } from '@/components/layout/AppLayout';

import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import Portfolio from "@/pages/Portfolio";
import AIAnalysis from "@/pages/AIAnalysis";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Support from "@/pages/Support";
import Subscription from "@/pages/Subscription";
import CheckoutResult from "@/pages/CheckoutResult";
import NotFound from "@/pages/not-found";
import { OnboardingModal, type OnboardingProfile } from '@/components/modals/OnboardingModal';

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
      <Route path="/subscription" component={Subscription} />
      <Route path="/checkout/success" component={() => <CheckoutResult success />} />
      <Route path="/checkout/cancel" component={() => <CheckoutResult success={false} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [onboardingDone, setOnboardingDone] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem('lr_disclaimer_accepted');
    if (accepted !== 'true') {
      setOnboardingDone(false);
    }
  }, []);

  const handleOnboardingComplete = (profile: OnboardingProfile) => {
    localStorage.setItem('lr_disclaimer_accepted', 'true');
    const existing = localStorage.getItem('lr_user_profile');
    const prev = existing ? JSON.parse(existing) : {};
    localStorage.setItem('lr_user_profile', JSON.stringify({
      ...prev,
      ...(profile.name     ? { name: profile.name }         : {}),
      ...(profile.email    ? { email: profile.email }       : {}),
      ...(profile.nickname ? { nickname: profile.nickname } : {}),
      ...(profile.phone    ? { phone: profile.phone }       : {}),
    }));
    // Store email for alert notifications
    if (profile.email) {
      localStorage.setItem('lr_profile_email', profile.email);
    }
    // Persist language choice
    if (profile.language) {
      const saved = localStorage.getItem('lr_user_profile');
      const p = saved ? JSON.parse(saved) : {};
      localStorage.setItem('lr_user_profile', JSON.stringify({ ...p, language: profile.language }));
    }
    // Send welcome email to user + admin notification
    if (profile.email) {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
      fetch(`${BASE}/api/ai/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      }).catch(() => {});
    }

    setOnboardingDone(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TranslationsProvider>
        <SubscriptionProvider>
          <AssetProvider>
            <AlertsProvider>
              <TooltipProvider>
                {!onboardingDone && (
                  <OnboardingModal onComplete={handleOnboardingComplete} />
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
        </SubscriptionProvider>
      </TranslationsProvider>
    </QueryClientProvider>
  );
}

export default App;
