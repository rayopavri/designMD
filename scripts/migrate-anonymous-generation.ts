/**
 * Drops the NOT NULL constraint on bundles.created_by and
 * generation_jobs.user_id so anonymous users can generate without
 * an account. FK references stay (signed-in users still attribute
 * correctly).
 *
 * Idempotent — DROP NOT NULL is a no-op when the column is already
 * nullable.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const client = postgres(DATABASE_URL!, { max: 1, ssl: 'require' });
  try {
    console.log('→ bundles.created_by → nullable...');
    await client.unsafe(`ALTER TABLE bundles ALTER COLUMN created_by DROP NOT NULL;`);
    console.log('  ✓');
    console.log('→ generation_jobs.user_id → nullable...');
    await client.unsafe(`ALTER TABLE generation_jobs ALTER COLUMN user_id DROP NOT NULL;`);
    console.log('  ✓');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
