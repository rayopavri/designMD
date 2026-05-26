import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';

const isLocalDb =
  env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');

const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 20,
  // Cap how long postgres-js will wait for a fresh TCP+TLS connection
  // before rejecting. On Vercel cold-starts to Supabase's PgBouncer, an
  // unbounded connect can wedge a worker through its maxDuration ceiling
  // and SIGKILL it before failJob() runs, stranding generation_jobs rows
  // in `running` forever. 10s is generous for a healthy connect (<1s
  // typical) while still letting watchdogs fire within Vercel's 60s.
  connect_timeout: 10,
  // PgBouncer transaction-pool mode (Supabase pooler on port 6543) does not
  // support prepared statements — disable them to avoid runtime errors.
  prepare: !env.DATABASE_URL.includes(':6543'),
  // Supabase requires TLS; skip for local.
  ssl: isLocalDb ? undefined : 'require',
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
