/**
 * Adds bundles.companion_status — companion prompt now runs as a second
 * deferred worker function. New bundles start at 'pending' and flip to
 * 'ready' once Sonnet completes. Existing rows stay 'ready'.
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
    console.log('→ Adding bundles.companion_status...');
    await client.unsafe(`
      ALTER TABLE bundles
        ADD COLUMN IF NOT EXISTS companion_status text NOT NULL DEFAULT 'ready';
    `);
    console.log('  ✓ done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
