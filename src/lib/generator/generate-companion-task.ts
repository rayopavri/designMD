/**
 * Companion-prompt worker — runs in parallel with the design.md author
 * step. Phase 1 (scrape-and-extract) enqueues both this worker and the
 * author worker simultaneously so the companion prompt can be ready
 * before Sonnet finishes writing DESIGN.md.
 *
 * Input is the extracted brand JSON (passed via QStash payload), not the
 * finished DESIGN.md — the companion prompt's job is to teach an AI tool
 * how to apply the design tokens, and the tokens are in the brand JSON.
 * Flips companion_status to 'ready' on success or 'failed' on error.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { generateCompanionPrompt } from '@/lib/ai/generate-companion-prompt';
import type { ExtractedBrand } from '@/lib/ai/gemini';

export interface GenerateCompanionPayload {
  bundleId: string;
  /** Optional jobId — present for normal pipeline calls so we can stamp
   *  per-stage telemetry timestamps. Absent for legacy direct invocations. */
  jobId?: string | null;
  brand: ExtractedBrand;
  designStyles: string[];
}

export async function runGenerateCompanion(payload: GenerateCompanionPayload): Promise<void> {
  const { bundleId, jobId, brand, designStyles } = payload;

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

  if (jobId) await stampJob(jobId, { companionStartedAt: new Date() });

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
    if (jobId) await stampJob(jobId, { companionDoneAt: new Date() });
  } catch (err) {
    console.error(`[generate-companion] Sonnet failed for ${bundleId}:`, err);
    await markFailed(bundleId, err instanceof Error ? err.message : String(err));
    if (jobId) await stampJob(jobId, { companionDoneAt: new Date() });
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
