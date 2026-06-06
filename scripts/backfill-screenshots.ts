/**
 * One-time backfill: capture + store an above-the-fold screenshot for every
 * published bundle that doesn't have one yet (preview_image_url IS NULL) and
 * has a source URL to scrape.
 *
 * SCREENSHOT-ONLY: re-scrapes each source URL for its Firecrawl viewport
 * screenshot, normalizes it (sharp → webp), uploads to Supabase Storage, and
 * sets bundles.preview_image_url. It does NOT touch design_md / companion_prompt
 * or any other field, and it does NOT bump updated_at (preserves library order).
 *
 *   pnpm tsx scripts/backfill-screenshots.ts
 *
 * Requires DATABASE_URL, FIRECRAWL_API_KEY, SUPABASE_URL, and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local. Run AFTER the preview_image_url
 * migration. Idempotent — skips bundles that already have a screenshot; dead
 * URLs are left NULL and can be retried by re-running.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { scrapeUrl } from '../src/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '../src/lib/storage/screenshots';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const CONCURRENCY = 3;

async function main() {
  const sql = postgres(DATABASE_URL!, { max: CONCURRENCY + 1, ssl: 'require' });
  try {
    const rows = await sql<{ id: string; source_url: string }[]>`
      SELECT id, source_url
      FROM bundles
      WHERE status = 'published'
        AND preview_image_url IS NULL
        AND source_url IS NOT NULL
      ORDER BY updated_at DESC
    `;
    console.log(`→ ${rows.length} published bundle(s) need a screenshot\n`);

    let stored = 0;
    let failed = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < rows.length) {
        const { id, source_url } = rows[cursor++];
        try {
          const scrape = await scrapeUrl(source_url);
          if (!scrape.screenshotUrl) {
            console.warn(`  – ${id}: no screenshot from ${source_url}`);
            failed++;
            continue;
          }
          const url = await captureAndStoreScreenshot({ screenshotUrl: scrape.screenshotUrl, key: id });
          if (!url) {
            console.warn(`  – ${id}: capture/upload returned null`);
            failed++;
            continue;
          }
          await sql`UPDATE bundles SET preview_image_url = ${url} WHERE id = ${id}`;
          stored++;
          console.log(`  ✓ ${id} → ${url}`);
        } catch (err) {
          failed++;
          console.error(`  ✗ ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    console.log(`\n✓ done — stored ${stored}, skipped/failed ${failed}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('\n✗ backfill failed:', err.message ?? err);
  process.exit(1);
});
