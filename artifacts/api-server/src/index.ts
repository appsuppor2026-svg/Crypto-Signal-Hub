import app from "./app.js";
import { logger } from "./lib/logger.js";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function syncStripeData(stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>) {
  // Detect account ID from DB
  const accountRows = await db.execute(sql`SELECT id FROM stripe.accounts LIMIT 1`);
  const accountId = (accountRows.rows[0] as any)?.id as string | undefined;
  if (!accountId) {
    logger.warn("No Stripe account found in DB — skipping product sync");
    return;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  for (const p of products.data) {
    await db.execute(sql`
      INSERT INTO stripe.products (_raw_data, _account_id, _last_synced_at)
      VALUES (${JSON.stringify(p)}::jsonb, ${accountId}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        _raw_data = EXCLUDED._raw_data,
        _last_synced_at = NOW()
    `);
  }

  const prices = await stripe.prices.list({ active: true, limit: 100 });
  for (const pr of prices.data) {
    await db.execute(sql`
      INSERT INTO stripe.prices (_raw_data, _account_id, _last_synced_at)
      VALUES (${JSON.stringify(pr)}::jsonb, ${accountId}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        _raw_data = EXCLUDED._raw_data,
        _last_synced_at = NOW()
    `);
  }

  logger.info({ products: products.data.length, prices: prices.data.length }, "Stripe catalog synced");
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — Stripe integration disabled");
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      await stripeSync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
      logger.info("Stripe webhook configured");
    }

    // Sync product catalog in background
    syncStripeData(stripe)
      .then(() => {})
      .catch((err) => logger.error({ err }, "Stripe catalog sync error"));

    // Background backfill
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill done"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));

    logger.info("Stripe initialized");
  } catch (error) {
    logger.warn({ err: error }, "Stripe init failed — payments may be unavailable");
  }
}

// Non-blocking
initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
