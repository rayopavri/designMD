/**
 * Adds bundles.preview_image_url — a durable above-the-fold website screenshot
 * (Supabase Storage public URL) shown as the detail-page hero. Populated by the
 * capture-screenshot worker (new generations) and scripts/backfill-screenshots.ts
 * (existing bundles).
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS). Run against the Supabase pooler:
 *   pnpm tsx scripts/migrate-add-preview-image-url.ts
 *
 * Requires DATABASE_URL in .env.local. (Deloitte WiFi blocks 6543 — tether to a
 * phone hotspot, or run the equivalent ALTER from the Supabase SQL editor.)
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
  const sql = postgres(DATABASE_URL!, { max: 1, ssl: 'require' });
  try {
    console.log('→ Adding bundles.preview_image_url...');
    await sql`ALTER TABLE bundles ADD COLUMN IF NOT EXISTS preview_image_url text`;
    console.log('  ✓ column added');

    console.log('→ Verifying...');
    const rows = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bundles' AND column_name = 'preview_image_url'
    `;
    console.log('  result:', rows);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('\n✗ migration failed:', err.message ?? err);
  process.exit(1);
});
