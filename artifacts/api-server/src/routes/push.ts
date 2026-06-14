import { Router } from 'express';
import type webpush from 'web-push';
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  updateSubscriptionAlerts,
  type StoredAlert,
} from '../services/pushService.js';

const router = Router();

router.get('/vapid-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: 'Push notifications not configured' });
    return;
  }
  res.json({ publicKey: key });
});

router.post('/subscribe', (req, res) => {
  const { subscription, alerts, email } = req.body as {
    subscription?: webpush.PushSubscription;
    alerts?: StoredAlert[];
    email?: string;
  };

  if (!subscription?.endpoint) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }

  saveSubscription(subscription, alerts ?? [], email);
  res.json({ success: true });
});

router.post('/update-alerts', (req, res) => {
  const { endpoint, alerts } = req.body as { endpoint?: string; alerts?: StoredAlert[] };
  if (!endpoint) {
    res.status(400).json({ error: 'Missing endpoint' });
    return;
  }
  updateSubscriptionAlerts(endpoint, alerts ?? []);
  res.json({ success: true });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) removeSubscription(endpoint);
  res.json({ success: true });
});

export default router;
