import app from "./app.js";
import { logger } from "./lib/logger.js";
import { getStripeSync } from "./stripeClient.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  try {
    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      // findOrCreateManagedWebhook requires stripe.accounts table (only on dev)
      stripeSync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`)
        .then(() => logger.info("Stripe webhook configured"))
        .catch((err) => logger.warn({ err }, "Stripe webhook setup skipped"));
    }

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
