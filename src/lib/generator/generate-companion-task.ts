/**
 * Companion-prompt worker — runs in parallel with the design.md author step.
 * Phase 1 (scrape-and-extract) enqueues both this worker and the author worker
 * simultaneously (each a thin { jobId }) so the companion prompt can be ready
 * before Sonnet finishes writing DESIGN.md.
 *
 * Inputs (brand JSON, design styles, draft bundleId) are hydrated from
 * generation_jobs.phase_payload — not the finished DESIGN.md — because the
 * companion's job is to teach an AI tool how to apply the design tokens, and
 * the tokens live in the brand JSON.
 *
 * Best-effort: the supervisor never re-dispatches the companion (it only
 * resumes the scrape/author phases), so if phase_payload has already been
 * cleared by a completed author run, this skips and the bundle keeps its
 * placeholder companion. Flips companion_status to 'ready' on success or
 * 'failed' on error.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { generateCompanionPrompt } from '@/lib/ai/generate-companion-prompt';
import { parseAuthorPhasePayload, type AuthorPhasePayload } from '@/lib/generator/phase-payload';

export interface GenerateCompanionPayload {
  jobId: string;
}

export async function runGenerateCompanion(payload: GenerateCompanionPayload): Promise<void> {
  const { jobId } = payload;

  const [jobRow] = await db
    .select({ phasePayload: generationJobs.phasePayload })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!jobRow) {
    console.error(`[generate-companion] job ${jobId} not found`);
    return;
  }

  let hydrated: AuthorPhasePayload;
  try {
    hydrated = parseAuthorPhasePayload(jobRow.phasePayload);
  } catch (err) {
    // phase_payload already consumed (author completed first) or malformed.
    // Companion is best-effort — leave the placeholder prompt in place.
    console.warn(
      `[generate-companion] cannot hydrate phase_payload for job ${jobId}; skipping:`,
      err instanceof Error ? err.message : err,
    );
    return;
  }
  const { bundleId, brand, designStyles } = hydrated;

  const [bundle] = await db
    .select({
      id: bundles.id,
      title: bundles.title,
      companionStatus: bundles.companionStatus,
    })
    .from(bundles)
    .where(eq(bundles.id, bundleId))
    .limit(1);

  if (!bundle) {
    console.error(`[generate-companion] bundle ${bundleId} not found`);
    return;
  }
  if (bundle.companionStatus === 'ready') {
    // Already done — idempotent no-op (e.g. retry of a delivered message).
    return;
  }

  await stampJob(jobId, { companionStartedAt: new Date() });

  try {
    const companion = await generateCompanionPrompt({
      brandName: bundle.title,
      brand,
      designStyles,
    });
    await db
      .update(bundles)
      .set({
        companionPrompt: companion,
        companionPromptVersion: 1,
        companionPromptUpdatedAt: new Date(),
        companionStatus: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, bundleId));
    await stampJob(jobId, { companionDoneAt: new Date() });
  } catch (err) {
    console.error(`[generate-companion] Sonnet failed for ${bundleId}:`, err);
    await markFailed(bundleId, err instanceof Error ? err.message : String(err));
    await stampJob(jobId, { companionDoneAt: new Date() });
  }
}

async function markFailed(bundleId: string, _reason: string): Promise<void> {
  await db
    .update(bundles)
    .set({ companionStatus: 'failed', updatedAt: new Date() })
    .where(eq(bundles.id, bundleId));
}

async function stampJob(
  jobId: string,
  stamps: Partial<typeof generationJobs.$inferInsert>,
): Promise<void> {
  try {
    await db
      .update(generationJobs)
      .set({ ...stamps, updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  } catch (err) {
    console.warn('[generate-companion] telemetry stamp failed:', err);
  }
}
