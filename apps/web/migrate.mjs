import postgres from 'postgres';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    id       SERIAL      PRIMARY KEY,
    filename TEXT        NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

const migrationsDir = join(__dirname, 'migrations');
let files;
try {
  files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();
} catch {
  console.log('No migrations directory found, skipping.');
  await sql.end();
  process.exit(0);
}

for (const file of files) {
  const rows = await sql`SELECT 1 FROM _migrations WHERE filename = ${file}`;
  if (rows.length > 0) {
    console.log(`  skip  ${file}`);
    continue;
  }

  console.log(`  apply ${file}...`);
  const content = await readFile(join(migrationsDir, file), 'utf-8');

  await sql.begin(async (tx) => {
    await tx.unsafe(content);
    await tx`INSERT INTO _migrations (filename) VALUES (${file})`;
  });

  console.log(`  done  ${file}`);
}

await sql.end();
