const CACHE_NAME = 'lr-sw-v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const SYMBOL_TO_COINGECKO = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
};

let activeAlerts = [];
let checkInterval = null;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  startPriceChecks();
});

// ── Web Push: server sends a push even when the browser is closed ──
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: '🚨 Alerta activada', body: event.data?.text() ?? '' };
  }

  const title = data.title ?? '🚨 Alerta activada';
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/favicon.svg',
    badge: data.badge ?? '/favicon.svg',
    tag: data.tag ?? 'lr-push',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: data.url ?? '/', alertId: data.alertId, symbol: data.symbol },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if (data.alertId) {
        notifyClients({ type: 'ALERT_TRIGGERED', payload: { alertId: data.alertId } });
      }
    })
  );
});

// ── Local background price checks (works when tab is open/backgrounded) ──
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SYNC_ALERTS') {
    activeAlerts = payload || [];
    if (activeAlerts.filter(a => !a.triggered).length > 0) {
      startPriceChecks();
    } else {
      stopPriceChecks();
    }
  }

  if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG' });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

function startPriceChecks() {
  if (checkInterval) return;
  checkInterval = setInterval(checkPrices, 60000);
  checkPrices();
}

function stopPriceChecks() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

async function checkPrices() {
  const untriggered = activeAlerts.filter(a => !a.triggered);
  if (untriggered.length === 0) { stopPriceChecks(); return; }

  const symbols = [...new Set(untriggered.map(a => a.symbol))];
  const ids = symbols.map(s => SYMBOL_TO_COINGECKO[s]).filter(Boolean).join(',');

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const data = await res.json();

    for (const alert of untriggered) {
      const cgId = SYMBOL_TO_COINGECKO[alert.symbol];
      if (!cgId || !data[cgId]) continue;

      const price = data[cgId].usd;
      const shouldTrigger =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice);

      if (!shouldTrigger) continue;

      activeAlerts = activeAlerts.map(a =>
        a.id === alert.id ? { ...a, triggered: true, triggeredAt: Date.now() } : a
      );

      const conditionText = alert.condition === 'above' ? 'superó' : 'cayó por debajo de';
      const fmt = (n) => n >= 1 ? `$${n.toLocaleString('es-ES')}` : `$${n.toFixed(4)}`;

      await self.registration.showNotification(`🚨 ${alert.symbol} · Alerta activada`, {
        body: `${alert.symbol} ${conditionText} ${fmt(alert.targetPrice)}. Ahora: ${fmt(price)}`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `alert-${alert.id}`,
        requireInteraction: true,
        data: { alertId: alert.id, symbol: alert.symbol, url: '/' },
        vibrate: [200, 100, 200],
      });

      notifyClients({ type: 'ALERT_TRIGGERED', payload: { alertId: alert.id } });
    }
  } catch {}
}

function notifyClients(message) {
  clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => client.postMessage(message));
  });
}
