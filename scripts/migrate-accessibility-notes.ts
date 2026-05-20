/**
 * Adds bundles.accessibility_notes — a public-facing advisory rendered
 * on bundle detail pages when the source brand has WCAG-failing contrast
 * pairs. Separate from review_notes (which is editor-only).
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
    console.log('→ Adding bundles.accessibility_notes...');
    await client.unsafe(`
      ALTER TABLE bundles
        ADD COLUMN IF NOT EXISTS accessibility_notes text;
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
