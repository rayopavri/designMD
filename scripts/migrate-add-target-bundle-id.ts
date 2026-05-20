/**
 * Adds generation_jobs.target_bundle_id — when set, the worker UPDATEs
 * that bundle in place instead of INSERTing a new row. Powers the
 * admin "Re-run pipeline" button on /admin/bundles.
 *
 * Uses @neondatabase/serverless (HTTP) for local execution since
 * direct TCP to Neon stateless-compute endpoints is unreliable from
 * some networks. Production app code keeps using postgres-js as before.
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
