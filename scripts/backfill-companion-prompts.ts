/**
 * Regenerate companion prompts for all existing bundles using the improved
 * system prompt — WITHOUT re-running the full pipeline (no FireCrawl, no
 * Gemini, no new extraction).
 *
 * Uses the spec-driven path: generateCompanionPromptFromSpec() reads the
 * existing bundles.designMd and calls Claude Sonnet to write a new companion
 * from the finished spec. The improved system prompt now:
 *   - Scopes the AI to visual tokens only (content/copy/IA stays untouched)
 *   - Adds a content-protection rule to Must NOT
 *   - Notes that "(inferred)" tokens are visual approximations
 *
 * Cost: ~$0.003 / bundle (Sonnet 4.6 input + output tokens).
 * Speed: ~10-20s per bundle. Use --batch=N to set concurrency (default 5).
 *
 * Modes:
 *   (default)   dry-run — lists bundles that would be updated, nothing written.
 *   --write     regenerate and persist companions.
 *   --slug=foo  only process the bundle with this slug (safe single-bundle test).
 *   --batch=N   concurrent Sonnet requests (default 5, max 10).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-companion-prompts.ts                  # dry-run
 *   pnpm tsx scripts/backfill-companion-prompts.ts --slug=hp --write
 *   pnpm tsx scripts/backfill-companion-prompts.ts --write          # all bundles
 *   pnpm tsx scripts/backfill-companion-prompts.ts --write --batch=3
 *
 * Requires .env.local with DATABASE_URL and ANTHROPIC_API_KEY. On corporate
 * WiFi ports 5432/6543 are blocked — tether to a phone hotspot first.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const WRITE = process.argv.includes('--write');
const SLUG = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
const BATCH_ARG = process.argv.find((a) => a.startsWith('--batch='))?.slice('--batch='.length);
const BATCH = Math.min(10, Math.max(1, BATCH_ARG ? parseInt(BATCH_ARG, 10) : 5));

/** Run an array of async tasks with a concurrency cap. */
async function pLimit<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { eq, isNotNull, and } = await import('drizzle-orm');
  const { generateCompanionPromptFromSpec } = await import(
    '../src/lib/ai/generate-companion-prompt'
  );

  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      designMd: bundles.designMd,
      designStyle: bundles.designStyle,
      companionStatus: bundles.companionStatus,
    })
    .from(bundles)
    .where(
      SLUG
        ? eq(bundles.slug, SLUG)
        : and(isNotNull(bundles.designMd), eq(bundles.companionStatus as any, 'ready')),
    );

  const eligible = rows.filter((r) => r.designMd && r.designMd.trim());
  console.log(
    `Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${SLUG ? ` (slug=${SLUG})` : ''} | batch=${BATCH}`,
  );
  console.log(`Eligible bundles: ${eligible.length}\n`);

  if (!WRITE) {
    for (const b of eligible) {
      console.log(`  would regenerate: ${b.slug} (${b.title ?? '(no title)'})`);
    }
    console.log(`\nDry run — nothing written. Re-run with --write to persist.`);
    process.exit(0);
  }

  let ok = 0;
  let failed = 0;

  const tasks = eligible.map((b) => async () => {
    const brandName = b.title ?? b.slug;
    try {
      const companion = await generateCompanionPromptFromSpec({
        brandName,
        designMd: b.designMd!,
        designStyles: b.designStyle ?? [],
      });

      await db
        .update(bundles)
        .set({
          companionPrompt: companion,
          companionPromptUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bundles.id, b.id));

      ok += 1;
      console.log(`  ✓ ${b.slug}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${b.slug}: ${err instanceof Error ? err.message : err}`);
    }
  });

  await pLimit(tasks, BATCH);

  console.log(`\nDone — ok: ${ok} | failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('✗ backfill failed:', err);
  process.exit(1);
});
