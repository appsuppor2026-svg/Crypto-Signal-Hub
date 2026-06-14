import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type SubStatus = 'none' | 'trialing' | 'active' | 'loading';

interface SubscriptionState {
  status: SubStatus;
  isActive: boolean;
  isTrial: boolean;
  periodEnd: number | null;
  trialEnd: number | null;
  email: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  checkStatus: (email: string) => Promise<void>;
  setEmail: (email: string) => void;
  openCheckout: (priceId: string, email: string) => Promise<void>;
  openPortal: (email: string) => Promise<void>;
  plans: Plan[];
  plansLoading: boolean;
}

export interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; trial_period_days?: number } | null;
  metadata: Record<string, string> | null;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  prices: Price[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    status: 'none',
    isActive: false,
    isTrial: false,
    periodEnd: null,
    trialEnd: null,
    email: null,
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Load persisted email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('lr_sub_email');
    if (savedEmail) {
      setState(s => ({ ...s, email: savedEmail, status: 'loading' }));
      checkStatus(savedEmail).catch(() => {
        setState(s => ({ ...s, status: 'none' }));
      });
    }
    // Load plans
    apiFetch('/api/stripe/plans')
      .then((d: { data: Plan[] }) => setPlans(d.data))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  const setEmail = useCallback((email: string) => {
    localStorage.setItem('lr_sub_email', email);
    setState(s => ({ ...s, email }));
  }, []);

  const checkStatus = useCallback(async (email: string) => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const data = await apiFetch(`/api/stripe/status?email=${encodeURIComponent(email)}`);
      setState(s => ({
        ...s,
        status: data.status === 'active' || data.status === 'trialing' ? data.status : 'none',
        isActive: data.isActive,
        isTrial: data.isTrial,
        periodEnd: data.currentPeriodEnd ?? null,
        trialEnd: data.trialEnd ?? null,
        email,
      }));
    } catch {
      setState(s => ({ ...s, status: 'none', isActive: false }));
    }
  }, []);

  const openCheckout = useCallback(async (priceId: string, email: string) => {
    setEmail(email);
    const data = await apiFetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, email }),
    });
    if (data.url) window.location.href = data.url;
  }, [setEmail]);

  const openPortal = useCallback(async (email: string) => {
    const data = await apiFetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (data.url) window.location.href = data.url;
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      ...state,
      checkStatus,
      setEmail,
      openCheckout,
      openPortal,
      plans,
      plansLoading,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
