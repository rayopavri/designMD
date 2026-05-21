/**
 * Replaces the old 6 "type" categories (mobile-apps, saas-web-apps, etc.)
 * with the 9 canonical "domain" categories that match the UI chips and
 * library filters. This unifies the taxonomy across DB + UI + Gemini.
 *
 * Foreign keys on bundles.primary_category_id and secondary_category_id
 * have ON DELETE RESTRICT, so we NULL them first before DELETing the
 * old categories. The backfill script runs after this and re-assigns
 * known bundles to the new category IDs.
 *
 * Idempotent: re-running on an already-migrated DB is safe.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const NEW_CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'productivity-saas', name: 'Productivity & SaaS' },
  { slug: 'developer-tools-ides', name: 'Developer Tools & IDEs' },
  { slug: 'ai-llm-platforms', name: 'AI & LLM Platforms' },
  { slug: 'database-devops', name: 'Database & DevOps' },
  { slug: 'design-creative-tools', name: 'Design & Creative Tools' },
  { slug: 'fintech-crypto', name: 'Fintech & Crypto' },
  { slug: 'e-commerce-retail', name: 'E-commerce & Retail' },
  { slug: 'media-consumer-tech', name: 'Media & Consumer Tech' },
  { slug: 'automotive', name: 'Automotive' },
];

async function main() {
  const sql = neon(DATABASE_URL!);

  console.log('→ Nullifying bundle FK references...');
  await sql`UPDATE bundles SET primary_category_id = NULL, secondary_category_id = NULL`;
  console.log('  ✓ FK refs cleared');

  console.log('→ Deleting old categories...');
  await sql`DELETE FROM categories`;
  console.log('  ✓ old categories removed');

  console.log('→ Inserting 9 canonical categories...');
  // categories.level NOT NULL + check (1 OR 2); these are all top-level → 1.
  for (let i = 0; i < NEW_CATEGORIES.length; i += 1) {
    const c = NEW_CATEGORIES[i];
    await sql`
      INSERT INTO categories (slug, name, level, sort_order)
      VALUES (${c.slug}, ${c.name}, 1, ${i})
    `;
  }
  console.log(`  ✓ ${NEW_CATEGORIES.length} categories inserted`);

  console.log('→ Verifying...');
  const rows = (await sql`SELECT slug, name FROM categories ORDER BY slug`) as Array<{
    slug: string;
    name: string;
  }>;
  if (rows.length !== NEW_CATEGORIES.length) {
    console.error(`  ✗ expected ${NEW_CATEGORIES.length} rows, got ${rows.length}`);
    process.exit(1);
  }
  for (const r of rows) console.log(`    ${r.slug.padEnd(28)} ${r.name}`);
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
