import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index';
import { users, systemAdminUsers, userRoles, roles } from '../schema/index';
import { eq } from 'drizzle-orm';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL required');

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function seedAdmin() {
  const email = await prompt('Admin E-Mail: ');
  const name = await prompt('Admin Name: ');

  const tempPassword = `Admin_${randomUUID().slice(0, 8)}!`;

  console.log('\nLege Super-Admin an...');

  const userId = `user_${randomUUID()}`;

  await db.insert(users).values({
    id: userId,
    email,
    name,
    emailVerified: true,
  }).onConflictDoNothing();

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existingUser) throw new Error('User konnte nicht angelegt werden');

  await db.insert(systemAdminUsers).values({
    userId: existingUser.id,
    role: 'superadmin',
    isActive: true,
  }).onConflictDoNothing();

  const [superAdminRole] = await db.select().from(roles).where(eq(roles.name, 'super_admin')).limit(1);

  if (superAdminRole) {
    await db.insert(userRoles).values({
      userId: existingUser.id,
      roleId: superAdminRole.id,
      tenantId: null,
    }).onConflictDoNothing();
  }

  await client.end();

  console.log('\n✅ Super-Admin angelegt:');
  console.log(`   E-Mail:    ${email}`);
  console.log(`   Temp-PW:   ${tempPassword}`);
  console.log('   ⚠️  Passwort beim ersten Login ändern!');
  console.log('   Passwort-Hash muss separat via Better Auth gesetzt werden.');
}

seedAdmin().catch((err) => {
  console.error('Admin-Seed fehlgeschlagen:', err);
  process.exit(1);
});
