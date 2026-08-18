/**
 * Adds generation_jobs.target_bundle_id — when set, the worker UPDATEs
 * that bundle in place instead of INSERTing a new row. Powers the
 * admin "Re-run pipeline" button on /admin/bundles.
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
  console.log('→ Adding generation_jobs.target_bundle_id...');
  await sql`
    ALTER TABLE generation_jobs
      ADD COLUMN IF NOT EXISTS target_bundle_id uuid
        REFERENCES bundles(id)
  `;
  console.log('  ✓ column added');

  console.log('→ Adding index for in-flight re-run lookup...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_jobs_target_bundle
      ON generation_jobs (target_bundle_id, status)
      WHERE target_bundle_id IS NOT NULL
  `;
  console.log('  ✓ index added');

  console.log('→ Verifying...');
  const rows = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
      AND column_name = 'target_bundle_id'
  `;
  console.log('  result:', rows);
}

main().catch((err) => {
  console.error('✗ migration failed:', err);
  process.exit(1);
});
