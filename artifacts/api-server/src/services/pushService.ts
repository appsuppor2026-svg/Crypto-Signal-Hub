import webpush from 'web-push';
import { logger } from '../lib/logger.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:appsuppor2026@gmail.com';

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
};

export interface StoredAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  triggered: boolean;
}

interface StoredSubscription {
  subscription: webpush.PushSubscription;
  alerts: StoredAlert[];
  email?: string;
  subscribedAt: number;
}

const subscriptions = new Map<string, StoredSubscription>();
let initialized = false;

export function initPushService(): void {
  if (initialized) return;
  initialized = true;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn('VAPID keys not configured — Web Push disabled');
    return;
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  logger.info({ subs: subscriptions.size }, 'Push service initialized');

  setInterval(() => void checkPricesAndNotify(), 5 * 60 * 1000);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function saveSubscription(
  subscription: webpush.PushSubscription,
  alerts: StoredAlert[],
  email?: string,
): void {
  subscriptions.set(subscription.endpoint, {
    subscription,
    alerts,
    email,
    subscribedAt: Date.now(),
  });
  logger.info({ total: subscriptions.size }, 'Push subscription saved');
}

export function removeSubscription(endpoint: string): void {
  subscriptions.delete(endpoint);
}

export function updateSubscriptionAlerts(endpoint: string, alerts: StoredAlert[]): void {
  const stored = subscriptions.get(endpoint);
  if (stored) {
    stored.alerts = alerts;
  }
}

async function checkPricesAndNotify(): Promise<void> {
  if (subscriptions.size === 0) return;

  const allSymbols = new Set<string>();
  for (const { alerts } of subscriptions.values()) {
    for (const a of alerts) {
      if (!a.triggered) allSymbols.add(a.symbol);
    }
  }
  if (allSymbols.size === 0) return;

  const ids = [...allSymbols]
    .map(s => SYMBOL_TO_COINGECKO[s])
    .filter(Boolean)
    .join(',');

  let prices: Record<string, { usd: number }>;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(12_000) },
    ) as any;
    if (!res.ok) return;
    prices = (await res.json()) as Record<string, { usd: number }>;
  } catch (err) {
    logger.warn({ err }, 'Price check fetch failed');
    return;
  }

  for (const [endpoint, stored] of subscriptions.entries()) {
    for (const alert of stored.alerts.filter(a => !a.triggered)) {
      const cgId = SYMBOL_TO_COINGECKO[alert.symbol];
      if (!cgId || !prices[cgId]) continue;

      const price = prices[cgId].usd;
      const shouldTrigger =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice);

      if (!shouldTrigger) continue;

      alert.triggered = true;

      const conditionText = alert.condition === 'above' ? 'superó' : 'cayó por debajo de';
      const fmt = (n: number) =>
        n >= 1 ? `$${n.toLocaleString('es-ES')}` : `$${n.toFixed(4)}`;

      const payload = JSON.stringify({
        title: `🚨 ${alert.symbol} · Alerta activada`,
        body: `${alert.symbol} ${conditionText} ${fmt(alert.targetPrice)}. Ahora: ${fmt(price)}`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `alert-${alert.id}`,
        alertId: alert.id,
        symbol: alert.symbol,
        url: '/',
      });

      try {
        await webpush.sendNotification(stored.subscription, payload);
        logger.info({ symbol: alert.symbol, alertId: alert.id }, 'Push sent');
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          subscriptions.delete(endpoint);
          logger.info({ endpoint }, 'Stale push subscription removed');
        } else {
          logger.warn({ err: err.message }, 'Push send failed');
        }
      }
    }
  }
}
