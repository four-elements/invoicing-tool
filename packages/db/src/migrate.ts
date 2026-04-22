import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

async function runMigrations() {
  const migrationClient = postgres(databaseUrl!, { max: 1 });
  const db = drizzle(migrationClient);

  console.log('Running Drizzle migrations...');
  await migrate(db, { migrationsFolder: join(__dirname, '../migrations') });
  console.log('Drizzle migrations complete.');

  console.log('Applying RLS policies...');
  const rlsSql = readFileSync(
    join(__dirname, '../migrations/0001_rls_policies.sql'),
    'utf-8'
  );
  await migrationClient.unsafe(rlsSql);
  console.log('RLS policies applied.');

  await migrationClient.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
