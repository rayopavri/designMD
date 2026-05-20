/**
 * Stage 1 smoke test.
 *
 * Usage:
 *   pnpm tsx scripts/test-scrape.ts https://stripe.com
 *
 * Runs the scrape-and-extract worker directly (no HTTP) against the
 * given URL using the system seed user as the job owner. Prints job
 * progress, final status, and the resulting bundle row.
 */
import { config } from 'dotenv';
import path from 'path';

// override: true — the parent shell may export ANTHROPIC_API_KEY="" which
// would otherwise win over the real value in .env.local.
config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: pnpm tsx scripts/test-scrape.ts <url>');
    process.exit(1);
  }

  // Dynamic imports so dotenv.config() runs BEFORE env.ts parses.
  const { db } = await import('../src/lib/db/client');
  const { generationJobs, bundles, users } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { normalizeUrl } = await import('../src/lib/generator/url');
  const { runScrapeAndExtract } = await import('../src/lib/generator/scrape-and-extract');

  // Find the system seed user (created by scripts/seed.ts).
  const [seedUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.firebaseUid, '__system_seed__'))
    .limit(1);
  if (!seedUser) {
    console.error(
      'System seed user not found. Run `pnpm tsx scripts/seed.ts` first to create it.',
    );
    process.exit(1);
  }

  const normalized = normalizeUrl(url);
  console.log(`→ URL:        ${url}`);
  console.log(`→ Normalized: ${normalized}`);
  console.log(`→ Owner:      ${seedUser.email} (${seedUser.id})`);

  // Insert a fresh job row.
  const [job] = await db
    .insert(generationJobs)
    .values({
      url,
      normalizedUrl: normalized,
      status: 'queued',
      currentStep: 'queued',
      userId: seedUser.id,
    })
    .returning({ id: generationJobs.id });
  if (!job) throw new Error('Failed to create generation job');
  console.log(`→ Job:        ${job.id}`);
  console.log('');

  const started = Date.now();
  console.log('Running pipeline (this calls Firecrawl + Gemini)…');
  await runScrapeAndExtract({ jobId: job.id });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  // Read back the final state.
  const [finalJob] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, job.id))
    .limit(1);
  if (!finalJob) throw new Error('Job row vanished');

  console.log('');
  console.log(`✓ Finished in ${elapsed}s`);
  console.log(`  status:       ${finalJob.status}`);
  console.log(`  currentStep:  ${finalJob.currentStep}`);
  if (finalJob.errorMessage) {
    console.log(`  errorStep:    ${finalJob.errorStep}`);
    console.log(`  errorMessage: ${finalJob.errorMessage}`);
    process.exit(1);
  }

  if (!finalJob.resultBundleId) {
    console.log('No result bundle was written.');
    process.exit(1);
  }

  const [bundle] = await db
    .select()
    .from(bundles)
    .where(eq(bundles.id, finalJob.resultBundleId))
    .limit(1);
  if (!bundle) throw new Error('Bundle row missing');

  console.log('');
  console.log('Draft bundle:');
  console.log(`  id:               ${bundle.id}`);
  console.log(`  slug:             ${bundle.slug}`);
  console.log(`  title:            ${bundle.title}`);
  console.log(`  status:           ${bundle.status}`);
  console.log(`  sourceDomain:     ${bundle.sourceDomain}`);
  console.log(`  authorName:       ${bundle.authorName}`);
  console.log(`  designStyle:      ${JSON.stringify(bundle.designStyle)}`);
  console.log(`  compatibleTools:  ${JSON.stringify(bundle.compatibleTools)}`);
  console.log(`  paletteColors:    ${JSON.stringify(bundle.paletteColors)}`);
  console.log(`  brandColor:       ${bundle.brandColor}`);
  console.log(`  description:      ${bundle.description.slice(0, 160)}${bundle.description.length > 160 ? '…' : ''}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
