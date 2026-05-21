/**
 * Drops bundles.screenshot_url — we removed the screenshot capture +
 * Vercel Blob storage path now that the home gallery renders palette-bar
 * library cards instead of website thumbnails. Gemini still gets the
 * screenshot in-memory from Firecrawl during extraction; we just don't
 * persist a URL anymore.
 *
 * Uses @neondatabase/serverless (HTTP) for local execution since direct
 * TCP to Neon stateless-compute endpoints is unreliable from some
 * networks.
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
