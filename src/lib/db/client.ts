import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';

const isLocalDb =
  env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');

const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 20,
  // PgBouncer transaction-pool mode (Supabase pooler on port 6543) does not
  // support prepared statements — disable them to avoid runtime errors.
  prepare: !env.DATABASE_URL.includes(':6543'),
  // Cloud Postgres (Neon, Supabase, etc.) requires TLS. Local DBs don't.
  ssl: isLocalDb ? undefined : 'require',
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
