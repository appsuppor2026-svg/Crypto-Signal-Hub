import { getUncachableStripeClient } from './stripeClient.js';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Creando productos LRC en Stripe...');

    // Check if LRC Pro already exists
    const existing = await stripe.products.search({
      query: "name:'LRC Pro' AND active:'true'"
    });

    if (existing.data.length > 0) {
      console.log('LRC Pro ya existe. Listando precios existentes:');
      for (const prod of existing.data) {
        const prices = await stripe.prices.list({ product: prod.id, active: true });
        for (const price of prices.data) {
          const interval = price.recurring?.interval ?? 'one_time';
          console.log(`  ${price.id}  ${price.unit_amount! / 100} ${price.currency.toUpperCase()}/${interval}`);
        }
      }
      return;
    }

    // Create LRC Pro product
    const product = await stripe.products.create({
      name: 'LRC Pro',
      description: 'Acceso completo a Liquidity Radar Crypto — análisis de liquidez, SAE, Arena y alertas inteligentes en tiempo real.',
      metadata: {
        app: 'liquidity-radar-crypto',
      },
    });
    console.log(`Producto creado: ${product.name} (${product.id})`);

    // Monthly €4.99
    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: 499,
      currency: 'eur',
      recurring: {
        interval: 'month',
        trial_period_days: 2,
      },
      metadata: { plan: 'monthly' },
    });
    console.log(`Precio mensual: €4.99/mes con 2 días de prueba (${monthly.id})`);

    // Annual €49.99
    const annual = await stripe.prices.create({
      product: product.id,
      unit_amount: 4999,
      currency: 'eur',
      recurring: {
        interval: 'year',
        trial_period_days: 2,
      },
      metadata: { plan: 'annual' },
    });
    console.log(`Precio anual: €49.99/año con 2 días de prueba (${annual.id})`);

    console.log('\n✅ Productos y precios creados correctamente.');
    console.log('Los webhooks sincronizarán los datos a tu base de datos automáticamente.');

  } catch (error: any) {
    console.error('Error creando productos:', error.message);
    process.exit(1);
  }
}

createProducts();
