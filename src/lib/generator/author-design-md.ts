/**
 * Phase 2 of the generation pipeline.
 *
 * Steps:
 *   writing-design-md     → Sonnet 4.6: YAML front-matter + canonical body
 *   persisting-design-md  → commit design.md + pending companion status,
 *                           kick off the companion worker in parallel
 *   linting               → @google/design.md linter parses & validates
 *   scoring               → coverage scorer derives 7 section scores
 *   ready_for_review      → promote bundle status (skipped on re-run)
 *
 * Split off from scrape-and-extract because the Sonnet call alone can
 * take 25-35s and was blowing past Vercel Hobby's 60s function cap when
 * combined with Firecrawl + Gemini in a single worker.
 *
 * Phase 1 (scrape-and-extract) passes the full brand object + a trimmed
 * scraped markdown through the QStash payload so we don't need a sidecar
 * table.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import type { ExtractedBrand } from '@/lib/ai/gemini';
import { generateDesignMd } from '@/lib/ai/generate-design-md';
import { enqueueTask } from '@/lib/queue';
import { advanceBatch } from '@/lib/generator/batch';
import { scoreFromLint } from '@/lib/generator/coverage';
import {
  lintDesignMd,
  renderAccessibilityAdvisory,
  renderLintSummary,
  type LintSummary,
} from '@/lib/generator/lint-design-md';

export interface AuthorDesignMdPayload {
  jobId: string;
  bundleId: string;
  url: string;
  scrapedMarkdown: string;
  brand: ExtractedBrand;
  /** True when the parent generation_jobs row is a re-run (preserves status). */
  isRerun: boolean;
  /** True when triggered by bulk-upload — skips quality gate and publishes directly. */
  autoPublish: boolean;
  /** Batch ID for sequential processing — chains to next queued job on completion/failure. */
  batchId: string | null;
}

export async function runAuthorDesignMd(payload: AuthorDesignMdPayload): Promise<void> {
  const { jobId, bundleId, url, scrapedMarkdown, brand, isRerun, autoPublish, batchId } = payload;

  // QStash retry guard — mirrors runScrapeAndExtract. If the prior
  // invocation already committed a terminal status (watchdog cleanup
  // marked failed, in-process failJob ran, or success path completed),
  // bail. Without this, a watchdog-failed invocation followed by a
  // QStash retry re-runs the AI author + lint + score and re-enqueues
  // Phase 3 from scratch, burning credits and overwriting bundle
  // content. Folds the existing autoPublish userId fetch into this
  // lookup so it's still one round-trip.
  const [jobRow] = await db
    .select({ status: generationJobs.status, userId: generationJobs.userId })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!jobRow) throw new Error(`generation job ${jobId} not found`);
  if (jobRow.status !== 'queued' && jobRow.status !== 'running') return;
  const editorUserId: string | null = autoPublish ? (jobRow.userId ?? null) : null;

  await setJobStep(jobId, 'writing-design-md');
  let designMdContent: string;
  try {
    const generated = await generateDesignMd({
      brand,
      url,
      scrapedMarkdown,
    });
    designMdContent = generated.content;
  } catch (err) {
    return failJob(jobId, 'writing-design-md', err, batchId);
  }

  // Persist design.md immediately + fire companion task so it runs in
  // parallel with the remaining lint + score steps (~3-4s saved).
  try {
    await db
      .update(bundles)
      .set({
        designMd: designMdContent,
        companionStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, bundleId));
  } catch (err) {
    return failJob(jobId, 'persisting-design-md', err, batchId);
  }
  try {
    await enqueueTask('generate-companion', { bundleId });
  } catch (err) {
    console.error('[author-design-md] failed to enqueue companion task:', err);
    // Continue — the bundle has design.md; companion can be retried later.
  }

  await setJobStep(jobId, 'linting');
  let lintSummary: LintSummary;
  try {
    lintSummary = await lintDesignMd(designMdContent);
  } catch (err) {
    return failJob(jobId, 'linting', err, batchId);
  }

  await setJobStep(jobId, 'scoring');
  const coverage = scoreFromLint(lintSummary, designMdContent);

  // Quality-gated promotion. Bundles with errors OR overall score < 40
  // stay personal so the editor queue isn't polluted with low-quality
  // drafts. Re-run mode preserves the existing status (the editor
  // already curated this bundle).
  const shouldPromote = lintSummary.counts.errors === 0 && coverage.overall >= 40;

  // Bulk-upload jobs auto-publish only when they clear this coverage bar.
  // Below it they land in pending_review for editorial review.
  const AUTO_PUBLISH_COVERAGE_THRESHOLD = 50;
  const meetsAutoPublishBar =
    autoPublish &&
    lintSummary.counts.errors === 0 &&
    coverage.overall >= AUTO_PUBLISH_COVERAGE_THRESHOLD;

  try {
    await db
      .update(bundles)
      .set({
        coverageScore: coverage.overall,
        coverageColors: coverage.colors,
        coverageTypography: coverage.typography,
        coverageLayout: coverage.layout,
        coverageElevation: coverage.elevation,
        coverageShapes: coverage.shapes,
        coverageComponents: coverage.components,
        coverageDosDonts: coverage.dosDonts,
        reviewNotes: renderLintSummary(lintSummary),
        accessibilityNotes: renderAccessibilityAdvisory(lintSummary),
        ...(isRerun
          ? {}
          : meetsAutoPublishBar
            ? {
                status: 'published' as const,
                submittedAt: new Date(),
                publishedAt: new Date(),
                reviewedAt: new Date(),
                reviewedBy: editorUserId,
                isCurated: true,
              }
            : autoPublish
              ? {
                  status: 'pending_review' as const,
                  submittedAt: new Date(),
                }
              : {
                  status: shouldPromote ? ('pending_review' as const) : ('personal' as const),
                  submittedAt: shouldPromote ? new Date() : null,
                }),
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, bundleId));
  } catch (err) {
    return failJob(jobId, 'scoring', err, batchId);
  }

  await db
    .update(generationJobs)
    .set({
      status: 'completed',
      currentStep: isRerun
        ? 'rerun_complete'
        : meetsAutoPublishBar
          ? 'published'
          : autoPublish
            ? 'held_for_review'
            : shouldPromote
              ? 'ready_for_review'
              : 'held_as_draft',
      resultBundleId: bundleId,
      imageData: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));

  await advanceBatch(batchId);
}

async function setJobStep(jobId: string, step: string): Promise<void> {
  await db
    .update(generationJobs)
    .set({ status: 'running', currentStep: step, updatedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
}

async function failJob(jobId: string, step: string, err: unknown, batchId?: string | null): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[author-design-md] job ${jobId} failed at ${step}:`, message);
  await db
    .update(generationJobs)
    .set({
      status: 'failed',
      errorStep: step,
      errorMessage: message.slice(0, 1000),
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  await advanceBatch(batchId);
}
