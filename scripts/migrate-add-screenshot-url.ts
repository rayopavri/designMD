/**
 * Adds bundles.screenshot_url — populated by writeDraftBundle() in the
 * pipeline worker. The pipeline downloads the Firecrawl screenshot and
 * uploads it to Vercel Blob; the resulting URL is persisted here so
 * the public home gallery can render real website thumbnails.
 *
 * Uses @neondatabase/serverless (HTTP) for local execution since direct
 * TCP to Neon stateless-compute endpoints is unreliable from some
 * networks. Production app code keeps using postgres-js as before.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const sql = neon(DATABASE_URL!);

  console.log('→ Adding bundles.screenshot_url...');
  await sql`
    ALTER TABLE bundles
      ADD COLUMN IF NOT EXISTS screenshot_url text
  `;
  console.log('  ✓ column added');

  console.log('→ Verifying...');
  const rows = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bundles'
      AND column_name = 'screenshot_url'
  `;
  console.log('  result:', rows);
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
