/**
 * One-time cleanup: hard-deletes the duplicate test bundles that
 * survived the re-run pipeline testing on 2026-05-21.
 *
 * Mirrors the admin Delete endpoint's cascade logic:
 *   - bundleVotes      (delete)
 *   - collectionItems  (delete)
 *   - bundleRequests   (null out completed_bundle_id)
 *   - generationJobs   (null out existing/target/result bundle_id)
 *   - discoveryCandidates (null out promoted_to_bundle_id)
 *   - bundles          (delete)
 *
 * Idempotent.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const DUPLICATE_SLUGS = [
  'linear-2',
  'linear-3',
  'linear-4',
  'linear-5',
  'linear-6',
  'linear-7',
  'stripe-2',
  'stripe-3',
  'stripe-4',
  'stripe-5',
  'vercel-2',
  'vercel-3',
];

async function main() {
  const sql = neon(DATABASE_URL!);

  console.log(`→ Deleting ${DUPLICATE_SLUGS.length} duplicate bundles...`);
  let deleted = 0;
  let missing = 0;

  for (const slug of DUPLICATE_SLUGS) {
    const rows = (await sql`
      SELECT id FROM bundles WHERE slug = ${slug}
    `) as Array<{ id: string }>;
    if (rows.length === 0) {
      console.log(`  - ${slug.padEnd(12)} (not found, skipped)`);
      missing += 1;
      continue;
    }
    const id = rows[0].id;

    await sql`DELETE FROM bundle_votes WHERE bundle_id = ${id}`;
    await sql`DELETE FROM collection_items WHERE bundle_id = ${id}`;
    await sql`UPDATE bundle_requests SET completed_bundle_id = NULL WHERE completed_bundle_id = ${id}`;
    await sql`
      UPDATE generation_jobs
      SET existing_bundle_id = CASE WHEN existing_bundle_id = ${id} THEN NULL ELSE existing_bundle_id END,
          target_bundle_id   = CASE WHEN target_bundle_id   = ${id} THEN NULL ELSE target_bundle_id END,
          result_bundle_id   = CASE WHEN result_bundle_id   = ${id} THEN NULL ELSE result_bundle_id END
      WHERE existing_bundle_id = ${id}
         OR target_bundle_id = ${id}
         OR result_bundle_id = ${id}
    `;
    await sql`UPDATE discovery_candidates SET promoted_to_bundle_id = NULL WHERE promoted_to_bundle_id = ${id}`;
    await sql`DELETE FROM bundles WHERE id = ${id}`;

    console.log(`  ✓ ${slug.padEnd(12)} deleted`);
    deleted += 1;
  }

  console.log(`\n→ Done. ${deleted} deleted, ${missing} skipped.`);

  console.log('\n→ Remaining bundle slugs:');
  const remaining = (await sql`
    SELECT slug FROM bundles ORDER BY slug
  `) as Array<{ slug: string }>;
  for (const r of remaining) console.log(`  - ${r.slug}`);
}

main().catch((err) => {
  console.error('✗ cleanup failed:', err);
  process.exit(1);
});
