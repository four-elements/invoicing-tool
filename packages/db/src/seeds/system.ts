import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';
import { roles, permissions, rolePermissions } from '../schema/index.js';
import { PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_PERMISSIONS } from '@invoicing/types/permissions';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL required');

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

async function seedSystem() {
  console.log('Seeding system roles and permissions...');

  // 1. Alle Permissions einfügen
  const allPermissions = Object.values(PERMISSIONS).map((key) => {
    const [module, resource, action] = key.split(':') as [string, string, string];
    return { key, module, resource, action };
  });

  for (const perm of allPermissions) {
    await db
      .insert(permissions)
      .values(perm)
      .onConflictDoNothing({ target: permissions.key });
  }
  console.log(`  ${allPermissions.length} Permissions eingefügt.`);

  // 2. System-Rollen einfügen
  for (const [, roleName] of Object.entries(SYSTEM_ROLES)) {
    await db
      .insert(roles)
      .values({
        name: roleName,
        isSystem: true,
        tenantId: null,
        description: `System-Rolle: ${roleName}`,
      })
      .onConflictDoNothing();
  }
  console.log(`  ${Object.keys(SYSTEM_ROLES).length} System-Rollen eingefügt.`);

  // 3. Rollen-Permissions verknüpfen
  for (const [roleName, permKeys] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    const role = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1).then(r => r[0]);
    if (!role) continue;

    for (const permKey of permKeys) {
      const perm = await db.select().from(permissions).where(eq(permissions.key, permKey)).limit(1).then(r => r[0]);
      if (!perm) continue;

      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: perm.id })
        .onConflictDoNothing();
    }
  }
  console.log('  Rollen-Permissions verknüpft.');

  await client.end();
  console.log('System-Seed abgeschlossen.');
}

seedSystem().catch((err) => {
  console.error('System-Seed fehlgeschlagen:', err);
  process.exit(1);
});
