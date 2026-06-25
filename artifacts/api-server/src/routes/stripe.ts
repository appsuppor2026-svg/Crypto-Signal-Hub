import { Router } from 'express';
import { storage } from '../storage.js';
import { stripeService } from '../stripeService.js';

const router: any = Router();

// GET /api/stripe/plans — lista productos con precios (directo desde Stripe API)
router.get('/plans', async (_req: any, res: any) => {
  try {
    const stripe = await import('../stripeClient.js').then(m => m.getUncachableStripeClient());

    const [productsResult, pricesResult] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] }),
    ]);

    const productsMap = new Map<string, any>();
    for (const p of productsResult.data) {
      productsMap.set(p.id, { id: p.id, name: p.name, description: p.description, prices: [] });
    }
    for (const pr of pricesResult.data) {
      const productId = typeof pr.product === 'string' ? pr.product : pr.product?.id;
      if (productId && productsMap.has(productId)) {
        productsMap.get(productId).prices.push({
          id: pr.id,
          unit_amount: pr.unit_amount,
          currency: pr.currency,
          recurring: pr.recurring,
          metadata: pr.metadata,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/checkout — crea sesión de checkout
router.post('/checkout', async (req: any, res: any) => {
  try {
    const { priceId, email } = req.body as { priceId: string; email: string };

    if (!priceId || !email) {
      res.status(400).json({ error: 'priceId and email are required' });
      return;
    }

    // Upsert user
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    let user = await storage.upsertUser({ id: userId, email });

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(email, userId);
      user = await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const host = `${req.protocol}://${req.get('host')}`;
    const session = await stripeService.createCheckoutSession(
      customerId!,
      priceId,
      `${host}/checkout/success`,
      `${host}/checkout/cancel`,
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/portal — portal de gestión para el cliente
router.post('/portal', async (req: any, res: any) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }

    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    const user = await storage.getUser(userId);
    if (!user?.stripeCustomerId) {
      res.status(404).json({ error: 'No customer found for this email' });
      return;
    }

    const host = `${req.protocol}://${req.get('host')}`;
    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      host,
    );
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const TEST_ACCOUNTS = new Set([
  'reviewer@liqradar.test',
  'google.play.review@liqradar.test',
]);

// GET /api/stripe/status?email=... — estado de suscripción
router.get('/status', async (req: any, res: any) => {
  try {
    const email = req.query.email as string;
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }

    // Cuenta de prueba para revisores de Play Store
    if (TEST_ACCOUNTS.has(email.toLowerCase())) {
      res.json({ status: 'active', isActive: true, isTrial: false, currentPeriodEnd: null, trialEnd: null });
      return;
    }

    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    const user = await storage.getUser(userId);

    if (!user?.stripeCustomerId) {
      res.json({ status: 'none', isActive: false });
      return;
    }

    const sub = await storage.getActiveSubscriptionByCustomer(user.stripeCustomerId);
    if (!sub) {
      res.json({ status: 'none', isActive: false });
      return;
    }

    res.json({
      status: sub.status,
      isActive: sub.status === 'active' || sub.status === 'trialing',
      isTrial: sub.status === 'trialing',
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
