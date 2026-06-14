import { PriceAlert } from '@/context/AlertsContext';

type SWMessageCallback = (alertId: string) => void;

let registration: ServiceWorkerRegistration | null = null;
let pushSubscription: PushSubscription | null = null;
const listeners: SWMessageCallback[] = [];

export async function registerSW(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return true;
  } catch {
    return false;
  }
}

function handleSWMessage(event: MessageEvent) {
  const { type, payload } = event.data || {};
  if (type === 'ALERT_TRIGGERED') {
    listeners.forEach(cb => cb(payload.alertId));
  }
}

export function onAlertTriggered(callback: SWMessageCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export async function syncAlertsToSW(alerts: PriceAlert[]) {
  const sw = await getActiveSW();
  if (!sw) return;
  sw.postMessage({ type: 'SYNC_ALERTS', payload: alerts });
}

async function getActiveSW(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = registration || await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.active || reg.installing || reg.waiting;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function showNotificationViaRegistration(title: string, body: string) {
  const reg = registration || (await navigator.serviceWorker?.getRegistration());
  if (reg && Notification.permission === 'granted') {
    const opts: NotificationOptions & { vibrate?: number[] } = {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      requireInteraction: false,
      vibrate: [200, 100, 200],
    };
    await reg.showNotification(title, opts);
  }
}

// ── Web Push subscription ──

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush(alerts: PriceAlert[], email?: string): Promise<boolean> {
  if (!('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

    const keyRes = await fetch(`${BASE}/api/push/vapid-key`);
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json() as { publicKey: string };

    const reg = registration || await navigator.serviceWorker.ready;
    if (!reg) return false;

    pushSubscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
    });

    const res = await fetch(`${BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: pushSubscription.toJSON(),
        alerts: alerts.map(a => ({
          id: a.id,
          symbol: a.symbol,
          condition: a.condition,
          targetPrice: a.targetPrice,
          triggered: a.triggered,
        })),
        email,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function syncAlertsToPushServer(alerts: PriceAlert[]): Promise<void> {
  if (!pushSubscription) return;
  try {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
    await fetch(`${BASE}/api/push/update-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: pushSubscription.endpoint,
        alerts: alerts.map(a => ({
          id: a.id,
          symbol: a.symbol,
          condition: a.condition,
          targetPrice: a.targetPrice,
          triggered: a.triggered,
        })),
      }),
    });
  } catch {}
}

export function getPushSubscription(): PushSubscription | null {
  return pushSubscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSubscription) return;
  try {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
    await fetch(`${BASE}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
    });
    await pushSubscription.unsubscribe();
    pushSubscription = null;
  } catch {}
}
