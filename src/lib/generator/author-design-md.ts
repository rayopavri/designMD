/**
 * Phase 2 of the generation pipeline.
 *
 * Steps:
 *   writing-design-md     → Gemini Flash (or OpenRouter fallback): canonical body
 *   persisting-design-md  → commit design.md (companion already running in parallel)
 *   linting               → @google/design.md linter parses & validates
 *   scoring               → coverage scorer derives 7 section scores
 *   ready_for_review      → promote bundle status (skipped on re-run)
 *
 * Split off from scrape-and-extract because the author call alone can
 * take 25-35s and was blowing past Vercel Hobby's 60s function cap when
 * combined with Firecrawl + Gemini in a single worker.
 *
 * Phase 1 (scrape-and-extract) persists the brand object + trimmed scraped
 * markdown + draft bundleId onto generation_jobs.phase_payload, then enqueues
 * this worker AND the companion-prompt worker (Phase 3) with a thin { jobId }.
 * Both run concurrently and hydrate their inputs from the DB, so the supervisor
 * can resume either one after a dropped message without re-scraping.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { generateDesignMd, appendWcagRows } from '@/lib/ai/generate-design-md';
import { dispatchReady } from '@/lib/generator/batch';
import { parseAuthorPhasePayload, type AuthorPhasePayload } from '@/lib/generator/phase-payload';
import { scoreFromLint } from '@/lib/generator/coverage';
import {
  lintDesignMd,
  renderAccessibilityAdvisory,
  renderLintSummary,
  type LintSummary,
} from '@/lib/generator/lint-design-md';

export interface AuthorDesignMdPayload {
  jobId: string;
}

export async function runAuthorDesignMd(payload: AuthorDesignMdPayload): Promise<void> {
  const { jobId } = payload;

  // Hydrate everything from the DB — the queue message is just { jobId }.
  // QStash retry guard — mirrors runScrapeAndExtract. If the prior invocation
  // already committed a terminal status (watchdog cleanup marked failed,
  // in-process failJob ran, or success path completed), bail. Without this, a
  // watchdog-failed invocation followed by a QStash retry re-runs the AI author
  // + lint + score and re-enqueues Phase 3 from scratch, burning credits and
  // overwriting bundle content.
  const [jobRow] = await db
    .select({
      status: generationJobs.status,
      userId: generationJobs.userId,
      url: generationJobs.url,
      autoPublish: generationJobs.autoPublish,
      targetBundleId: generationJobs.targetBundleId,
      batchId: generationJobs.batchId,
      phasePayload: generationJobs.phasePayload,
    })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!jobRow) throw new Error(`generation job ${jobId} not found`);
  if (jobRow.status !== 'queued' && jobRow.status !== 'running') return;

  const batchId = jobRow.batchId;
  const autoPublish = Boolean(jobRow.autoPublish);
  const isRerun = Boolean(jobRow.targetBundleId);
  const url = jobRow.url;
  const editorUserId: string | null = autoPublish ? (jobRow.userId ?? null) : null;

  let hydrated: AuthorPhasePayload;
  try {
    hydrated = parseAuthorPhasePayload(jobRow.phasePayload);
  } catch (err) {
    return failJob(jobId, 'hydrate-payload', err, batchId);
  }
  const { bundleId, brand, scrapedMarkdown, userFeedback } = hydrated;

  await setJobStep(jobId, 'writing-design-md');
  let designMdContent: string;
  try {
    const generated = await generateDesignMd({
      brand,
      url,
      scrapedMarkdown,
      userFeedback,
    });
    designMdContent = generated.content;
  } catch (err) {
    return failJob(jobId, 'writing-design-md', err, batchId);
  }

  // Persist design.md. The companion worker is already running in parallel
  // (enqueued by Phase 1 alongside this worker), so we don't fire it here.
  try {
    await db
      .update(bundles)
      .set({
        designMd: designMdContent,
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, bundleId));
  } catch (err) {
    return failJob(jobId, 'persisting-design-md', err, batchId);
  }

  await setJobStep(jobId, 'linting', { designMdDoneAt: new Date() });
  let lintSummary: LintSummary;
  try {
    lintSummary = await lintDesignMd(designMdContent);
  } catch (err) {
    return failJob(jobId, 'linting', err, batchId);
  }

  // Splice WCAG-derived don'ts back into the Do's and Don'ts table.
  // These are only knowable AFTER the linter runs on the generated content
  // (they come from contrast-ratio checks against the extracted colour tokens),
  // so they can't be fed to the author model upfront. We append them
  // programmatically with a ⚠️ WCAG prefix so they're clearly distinguished
  // from the AI-inferred rows.
  if (lintSummary.derivedDonts.length > 0) {
    designMdContent = appendWcagRows(designMdContent, lintSummary.derivedDonts);
    // Persist the updated content (WCAG rows appended).
    try {
      await db
        .update(bundles)
        .set({ designMd: designMdContent, updatedAt: new Date() })
        .where(eq(bundles.id, bundleId));
    } catch (err) {
      // Non-fatal: coverage scoring can proceed with the in-memory copy.
      console.warn('[author-design-md] failed to persist WCAG-appended design.md:', err instanceof Error ? err.message : err);
    }
  }

  await setJobStep(jobId, 'scoring', { lintDoneAt: new Date() });
  const coverage = scoreFromLint(lintSummary, designMdContent);

  // Quality-gated promotion. Bundles with errors OR overall score < 40
  // stay personal so the editor queue isn't polluted with low-quality
  // drafts. Re-run mode preserves the existing status (the editor
  // already curated this bundle).
  const shouldPromote = lintSummary.counts.errors === 0 && coverage.overall >= 40;

  // Auto-publish jobs (bulk-upload and editor-initiated generations) publish
  // directly when they clear this coverage bar. Below it they land in
  // pending_review for editorial review.
  const AUTO_PUBLISH_COVERAGE_THRESHOLD = 60;
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
      phasePayload: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));

  // Batch job done → free its slot and refill immediately. Best-effort; the
  // supervisor cron backstops this if the call is lost.
  if (batchId) {
    await dispatchReady().catch((dispatchErr) =>
      console.error(`[author-design-md] dispatchReady after complete (${jobId}) failed:`, dispatchErr),
    );
  }
}

async function setJobStep(
  jobId: string,
  step: string,
  stamps?: Partial<typeof generationJobs.$inferInsert>,
): Promise<void> {
  try {
    await db
      .update(generationJobs)
      .set({ status: 'running', currentStep: step, updatedAt: new Date(), ...stamps })
      .where(eq(generationJobs.id, jobId));
  } catch (err) {
    if (!stamps) throw err;
    console.warn(
      `[author-design-md] setJobStep with stamps failed (${err instanceof Error ? err.message : String(err)}) — retrying without telemetry columns`,
    );
    await db
      .update(generationJobs)
      .set({ status: 'running', currentStep: step, updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  }
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
      phasePayload: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  if (batchId) {
    await dispatchReady().catch((dispatchErr) =>
      console.error(`[author-design-md] dispatchReady after fail (${jobId}) failed:`, dispatchErr),
    );
  }
}
