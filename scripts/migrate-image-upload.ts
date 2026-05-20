/**
 * One-off migration for Phase 1C image-upload support.
 *
 * Adds upload-source columns to generation_jobs and makes normalized_url
 * nullable. Run with: pnpm tsx scripts/migrate-image-upload.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const SQL = `
ALTER TABLE generation_jobs
  ALTER COLUMN normalized_url DROP NOT NULL;

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS image_data text,
  ADD COLUMN IF NOT EXISTS image_mime_type text,
  ADD COLUMN IF NOT EXISTS image_hash text,
  ADD COLUMN IF NOT EXISTS brand_name text;

CREATE INDEX IF NOT EXISTS idx_jobs_image_hash
  ON generation_jobs (image_hash, user_id);
`;

async function main() {
  const client = postgres(DATABASE_URL!, { max: 1, ssl: 'require' });
  try {
    console.log('→ Applying image-upload migration...');
    await client.unsafe(SQL);
    console.log('  ✓ done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
