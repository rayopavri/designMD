/**
 * Companion-prompt worker — runs as a second function after the main
 * scrape-and-extract pipeline finishes.
 *
 * Loads the persisted bundle, extracts the brand name + designMd + design
 * styles already saved by the main worker, then calls Sonnet to write the
 * tool-agnostic companion prompt. Flips companion_status to 'ready' on
 * success or 'failed' on error.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { generateCompanionPrompt } from '@/lib/ai/generate-companion-prompt';

export interface GenerateCompanionPayload {
  bundleId: string;
}

export async function runGenerateCompanion(payload: GenerateCompanionPayload): Promise<void> {
  const { bundleId } = payload;

  const [bundle] = await db
    .select({
      id: bundles.id,
      title: bundles.title,
      designMd: bundles.designMd,
      designStyle: bundles.designStyle,
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
  if (!bundle.designMd) {
    await markFailed(bundleId, 'designMd missing — cannot generate companion');
    return;
  }

  try {
    const companion = await generateCompanionPrompt({
      brandName: bundle.title,
      designMd: bundle.designMd,
      designStyles: bundle.designStyle ?? [],
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
  } catch (err) {
    console.error(`[generate-companion] Sonnet failed for ${bundleId}:`, err);
    await markFailed(bundleId, err instanceof Error ? err.message : String(err));
  }
}

async function markFailed(bundleId: string, _reason: string): Promise<void> {
  await db
    .update(bundles)
    .set({ companionStatus: 'failed', updatedAt: new Date() })
    .where(eq(bundles.id, bundleId));
}
