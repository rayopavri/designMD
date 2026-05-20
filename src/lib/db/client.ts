import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';

const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 20,
  // Neon and most cloud Postgres providers require TLS
  ssl: env.NODE_ENV === 'production' || env.DATABASE_URL.includes('neon') ? 'require' : undefined,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
