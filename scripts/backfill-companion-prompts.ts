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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sbGet(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bundles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const { generateCompanionPromptFromSpec } = await import(
    '../src/lib/ai/generate-companion-prompt'
  );

  const query = SLUG
    ? `bundles?select=id,slug,title,design_md,design_style,companion_status&slug=eq.${SLUG}`
    : `bundles?select=id,slug,title,design_md,design_style,companion_status&companion_status=eq.ready&design_md=not.is.null&limit=1000`;

  const rows: Array<{
    id: string;
    slug: string;
    title: string | null;
    design_md: string | null;
    design_style: string[];
    companion_status: string;
  }> = await sbGet(query);

  const eligible = rows.filter((r) => r.design_md && r.design_md.trim());
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
        designMd: b.design_md!,
        designStyles: b.design_style ?? [],
      });

      await sbPatch(b.id, {
        companion_prompt: companion,
        companion_prompt_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

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
