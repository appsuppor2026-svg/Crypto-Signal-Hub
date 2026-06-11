import { PriceAlert } from '@/context/AlertsContext';

type SWMessageCallback = (alertId: string) => void;

let registration: ServiceWorkerRegistration | null = null;
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
    await reg.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      requireInteraction: false,
      vibrate: [200, 100, 200],
    });
  }
}
