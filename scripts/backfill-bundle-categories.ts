/**
 * One-time backfill: assigns categories to the 12 known existing bundles
 * after the category seed was replaced with the 9 domain categories.
 *
 * Bundles not in the override map are left NULL — editors can fix
 * manually via /admin/bundles. Future bundles get their category
 * automatically from the Gemini enum-constrained extraction.
 *
 * Idempotent: re-runs safely.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const BUNDLE_OVERRIDES: Record<string, string> = {
  linear: 'developer-tools-ides',
  'linear-2': 'developer-tools-ides',
  'linear-3': 'developer-tools-ides',
  'linear-4': 'developer-tools-ides',
  'linear-5': 'developer-tools-ides',
  'linear-6': 'developer-tools-ides',
  'linear-7': 'developer-tools-ides',
  vercel: 'developer-tools-ides',
  'vercel-2': 'developer-tools-ides',
  'vercel-3': 'developer-tools-ides',
  stripe: 'fintech-crypto',
  'stripe-2': 'fintech-crypto',
  'stripe-3': 'fintech-crypto',
  'stripe-4': 'fintech-crypto',
  'stripe-5': 'fintech-crypto',
  notion: 'productivity-saas',
  carbon: 'developer-tools-ides',
  atlassian: 'productivity-saas',
  ramp: 'fintech-crypto',
  arc: 'media-consumer-tech',
  apple: 'media-consumer-tech',
  anthropic: 'ai-llm-platforms',
  firecrawl: 'developer-tools-ides',
  wise: 'fintech-crypto',
  kosbiotic: 'media-consumer-tech',
};

async function main() {
  const sql = neon(DATABASE_URL!);

  console.log('→ Resolving category slugs to IDs...');
  const catRows = (await sql`SELECT id, slug FROM categories`) as Array<{
    id: string;
    slug: string;
  }>;
  const idBySlug = new Map(catRows.map((r) => [r.slug, r.id]));

  // Sanity: every override target must exist.
  for (const targetSlug of Object.values(BUNDLE_OVERRIDES)) {
    if (!idBySlug.has(targetSlug)) {
      console.error(`✗ category slug not found in DB: ${targetSlug}`);
      console.error(`  run scripts/migrate-replace-categories.ts first`);
      process.exit(1);
    }
  }

  console.log(`  ✓ ${idBySlug.size} categories resolved`);

  let assigned = 0;
  let missing = 0;
  for (const [bundleSlug, categorySlug] of Object.entries(BUNDLE_OVERRIDES)) {
    const categoryId = idBySlug.get(categorySlug)!;
    const result = (await sql`
      UPDATE bundles
      SET primary_category_id = ${categoryId}, updated_at = NOW()
      WHERE slug = ${bundleSlug}
      RETURNING slug
    `) as Array<{ slug: string }>;
    if (result.length > 0) {
      console.log(`  ✓ ${bundleSlug.padEnd(36)} → ${categorySlug}`);
      assigned += 1;
    } else {
      console.log(`  - ${bundleSlug.padEnd(36)} (not found in DB, skipped)`);
      missing += 1;
    }
  }

  console.log(`\n→ Done. ${assigned} assigned, ${missing} skipped.`);

  console.log('\n→ Bundles still without a category:');
  const orphaned = (await sql`
    SELECT slug, title FROM bundles WHERE primary_category_id IS NULL ORDER BY slug
  `) as Array<{ slug: string; title: string }>;
  if (orphaned.length === 0) {
    console.log('  (none — all bundles have a category)');
  } else {
    for (const r of orphaned) console.log(`  - ${r.slug.padEnd(36)} ${r.title}`);
  }
}

main().catch((err) => {
  console.error('✗ backfill failed:', err);
  process.exit(1);
});
