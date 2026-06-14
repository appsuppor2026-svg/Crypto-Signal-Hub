import { Router, type IRouter } from 'express';
import { storage } from '../storage.js';
import { stripeService } from '../stripeService.js';

const router: IRouter = Router();

// GET /api/stripe/plans — lista productos con precios
router.get('/plans', async (_req, res) => {
  try {
    const rows = await storage.listProductsWithPrices();

    const productsMap = new Map<string, any>();
    for (const row of rows) {
      if (!productsMap.has(row.product_id as string)) {
        productsMap.set(row.product_id as string, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id as string).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          metadata: row.price_metadata,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/checkout — crea sesión de checkout
router.post('/checkout', async (req, res) => {
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
router.post('/portal', async (req, res) => {
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

// GET /api/stripe/status?email=... — estado de suscripción
router.get('/status', async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }

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
