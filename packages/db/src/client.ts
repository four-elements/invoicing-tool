import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const poolMin = Number(process.env['DATABASE_POOL_MIN'] ?? '2');
const poolMax = Number(process.env['DATABASE_POOL_MAX'] ?? '10');

const queryClient = postgres(databaseUrl, {
  max: poolMax,
  idle_timeout: 20,
  connect_timeout: 10,
});

void poolMin; // min_connections nicht unterstützt in postgres.js v3

export const db = drizzle(queryClient, { schema });

export type DrizzleDB = typeof db;
