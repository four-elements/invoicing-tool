import { sql } from 'drizzle-orm';
import { db } from '@invoicing/db/client';
import type { DrizzleDB } from '@invoicing/db/client';

// Diese Funktion MUSS am Anfang JEDER Server Action aufgerufen werden
export async function withTenantContext<T>(
  tenantId: string,
  actorType: 'tenant_user' | 'system_admin',
  fn: (db: DrizzleDB) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT
        set_config('app.current_tenant_id', ${tenantId}, true),
        set_config('app.actor_type', ${actorType}, true)
    `);
    return fn(tx as unknown as DrizzleDB);
  });
}
