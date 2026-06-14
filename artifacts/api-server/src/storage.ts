import { users } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import { db } from '@workspace/db';

export class Storage {
  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProductsWithPrices() {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = true
        ORDER BY id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active,
        pr.metadata as price_metadata
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async getActiveSubscriptionByCustomer(customerId: string) {
    const result = await db.execute(sql`
      SELECT * FROM stripe.subscriptions
      WHERE customer = ${customerId}
        AND status IN ('active', 'trialing')
      ORDER BY created DESC
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(data: { id: string; email: string }) {
    const [user] = await db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({ target: users.id, set: { email: data.email } })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, info: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }) {
    const [user] = await db.update(users).set(info).where(eq(users.id, userId)).returning();
    return user;
  }
}

export const storage = new Storage();
