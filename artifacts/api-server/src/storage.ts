// @ts-ignore — drizzle-orm type mismatch between workspace packages
import { users } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
// @ts-ignore — drizzle-orm type mismatch between workspace packages
import { db } from '@workspace/db';

const _db = db as any;
const _users = users as any;

export class Storage {
  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}` as any
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
    ` as any);
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}` as any
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
    ` as any);
    return result.rows[0] || null;
  }

  async getUser(id: string) {
    const [user] = await _db.select().from(_users).where(eq(_users.id, id) as any);
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await _db.select().from(_users).where(eq(_users.email, email) as any);
    return user;
  }

  async upsertUser(data: { id: string; email: string }) {
    const [user] = await _db
      .insert(_users)
      .values(data)
      .onConflictDoUpdate({ target: _users.id, set: { email: data.email } })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, info: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }) {
    const [user] = await _db.update(_users).set(info).where(eq(_users.id, userId) as any).returning();
    return user;
  }
}

export const storage = new Storage();
