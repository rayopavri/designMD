/**
 * Adds bundles.screenshot_url — populated by writeDraftBundle() in the
 * pipeline worker. The pipeline downloads the Firecrawl screenshot and
 * uploads it to Vercel Blob; the resulting URL is persisted here so
 * the public home gallery can render real website thumbnails.
 *
 * Uses postgres-js against the DATABASE_URL from .env.local. Prepared
 * statements are disabled when the URL points to the Supabase transaction
 * pooler (port 6543).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: !DATABASE_URL.includes(':6543') });

async function main() {
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
