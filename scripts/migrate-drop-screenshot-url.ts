/**
 * Drops bundles.screenshot_url — we removed the screenshot capture +
 * Vercel Blob storage path now that the home gallery renders palette-bar
 * library cards instead of website thumbnails. Gemini still gets the
 * screenshot in-memory from Firecrawl during extraction; we just don't
 * persist a URL anymore.
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
  console.log('→ Dropping bundles.screenshot_url...');
  await sql`ALTER TABLE bundles DROP COLUMN IF EXISTS screenshot_url`;
  console.log('  ✓ column dropped');

  console.log('→ Verifying...');
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'bundles'
      AND column_name = 'screenshot_url'
  `;
  if (rows.length === 0) {
    console.log('  ✓ confirmed: screenshot_url is gone');
  } else {
    console.error('  ✗ unexpected: column still exists', rows);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
