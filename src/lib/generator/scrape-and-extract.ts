/**
 * Pipeline worker Phase 1 — scrape + extract + persist draft bundle.
 *
 * Steps:
 *   scraping             → Firecrawl renders the URL
 *   parsing-computed     → pull CSS vars + dominant hexes + tailwind classes
 *   extracting           → Gemini Flash (vision + computed): structured tokens
 *   resolving-orphans    → wire unmounted color/typography tokens
 *   persisting           → write draft bundle (status=personal)
 *
 * Phase 2 (Sonnet design.md + lint + score) lives in author-design-md.ts.
 * Splitting was forced by Vercel's function cap — the Sonnet call alone takes
 * 25-35s. Phase 1 persists its outputs (brand, trimmed markdown, draft
 * bundleId) onto generation_jobs.phase_payload, sets phase='author', then
 * enqueues Phase 2 + Phase 3 with a thin { jobId }. Those workers hydrate from
 * the DB, so a dropped message is recovered by the supervisor as a resume of
 * the current phase — never a re-scrape.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories, generationJobs } from '@/lib/db/schema';
import {
  extractBrandFromImage,
  extractBrandFromMarkdown,
  type ExtractedBrand,
} from '@/lib/ai/gemini';
import { scrapeUrlSmart, type ScrapeResult } from '@/lib/ai/firecrawl';
import { enqueueTask } from '@/lib/queue';
import {
  extractComputedStyles,
  type ComputedStyleSnapshot,
} from '@/lib/generator/extract-computed-styles';
import { resolveOrphans } from '@/lib/generator/resolve-orphans';
import { extractDomain } from '@/lib/generator/url';
import { uniqueBundleSlug } from '@/lib/generator/slug';
import { dispatchReady } from '@/lib/generator/batch';
import type { AuthorPhasePayload } from '@/lib/generator/phase-payload';

// QStash payloads are capped at 1MB. Trim the scraped markdown before
// passing to Phase 2 — design.md authoring only needs a representative
// chunk of the page text. 40k chars ≈ 10k tokens which is plenty for
// Sonnet's context.
const PHASE_2_MARKDOWN_CAP = 40_000;

// Fresh (non-re-run) URL jobs have no coverage gaps to derive a search query
// from, so subpage discovery via Firecrawl map() would be generic. Seed it with
// a design-oriented query so map() surfaces design-rich pages (style guides,
// component / pricing pages) — the same `map({ search })` lever the re-run path
// uses from gap analysis. rankDesignUrls still re-ranks afterward, so this only
// widens the candidate set, never narrows correctness.
const DEFAULT_DESIGN_SEARCH = 'design system colors typography components layout buttons';

export interface ScrapeAndExtractPayload {
  jobId: string;
  /** On re-runs: free-text editor feedback about what was wrong last time. Threaded into
   *  Gemini extraction and forwarded to the author worker. Ephemeral to this run (payload-only). */
  feedback?: string;
}

export async function runScrapeAndExtract(payload: ScrapeAndExtractPayload): Promise<void> {
  const { jobId, feedback } = payload;

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!job) throw new Error(`generation job ${jobId} not found`);
  if (job.status !== 'queued' && job.status !== 'running') return;

  const isUpload = job.sourceType === 'upload';

  // ─── 0. Coverage gap analysis (re-run mode only) ─────────
  // Load the existing bundle's per-section scores and derive focused hints
  // for Gemini + a search query to bias mapUrl toward missing content.
  let gapHints: string | undefined;
  let searchQuery: string | undefined;

  if (!isUpload && job.targetBundleId) {
    const [cov] = await db
      .select({
        coverageColors: bundles.coverageColors,
        coverageTypography: bundles.coverageTypography,
        coverageLayout: bundles.coverageLayout,
        coverageElevation: bundles.coverageElevation,
        coverageShapes: bundles.coverageShapes,
        coverageComponents: bundles.coverageComponents,
        coverageDosDonts: bundles.coverageDosDonts,
      })
      .from(bundles)
      .where(eq(bundles.id, job.targetBundleId))
      .limit(1);

    if (cov) {
      const GAP_THRESHOLD = 40;
      const gaps: string[] = [];
      const searchTerms: string[] = [];

      if ((cov.coverageColors ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Colors: extract more role-bound tokens (primary, secondary, neutral, surface, error, etc.) with hex values and rationale');
        searchTerms.push('colors palette brand');
      }
      if ((cov.coverageTypography ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Typography: identify display, headline, body, label scale levels with font families, sizes, and weights');
        searchTerms.push('typography fonts type');
      }
      if ((cov.coverageLayout ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Layout: describe grid system, max-width, spacing rhythm, responsive breakpoints');
        searchTerms.push('layout grid spacing');
      }
      if ((cov.coverageShapes ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Shapes: extract border-radius tokens at each scale (sm, md, lg, full)');
        searchTerms.push('shapes radius corners');
      }
      if ((cov.coverageComponents ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Components: identify buttons, cards, inputs, badges, navigation with full token specs');
        searchTerms.push('components buttons forms inputs');
      }

      if (gaps.length > 0) {
        gapHints = gaps.join('\n');
        searchQuery = searchTerms.join(' ');
      }
    }
  }

  // Fresh URL jobs (and re-runs whose sections all passed threshold) get a
  // default design-oriented search query so subpage discovery is biased toward
  // design-rich pages rather than generic links.
  if (!isUpload && !searchQuery) {
    searchQuery = DEFAULT_DESIGN_SEARCH;
  }

  let scrape: ScrapeResult;
  let brand: ExtractedBrand;

  if (isUpload) {
    // ─── 1u. Process uploaded image ────────────────────
    await setJobStep(jobId, 'processing-image');
    if (!job.imageData || !job.imageMimeType || !job.brandName) {
      return failJob(
        jobId,
        'processing-image',
        new Error('Upload job missing imageData / imageMimeType / brandName'),
        job.batchId,
      );
    }
    // Synthesise a scrape-shaped object so the rest of the pipeline
    // (writeDraftBundle, designMd context) doesn't need an upload branch.
    scrape = {
      url: job.url,
      title: job.brandName,
      description: '',
      markdown: '',
      html: null,
      screenshotUrl: null,
      ogImageUrl: null,
      brandLogoUrl: null,
      language: null,
      statusCode: null,
      branding: null,
      designExtract: null,
    };

    // ─── 2u. Gemini image-only extraction ──────────────
    await setJobStep(jobId, 'extracting');
    try {
      brand = await extractBrandFromImage({
        brandName: job.brandName,
        imageBase64: job.imageData,
        imageMimeType: job.imageMimeType,
      });
    } catch (err) {
      return failJob(jobId, 'extracting', err, job.batchId);
    }
  } else {
    // ─── 1. Scrape ───────────────────────────────────
    await setJobStep(jobId, 'scraping');
    try {
      scrape = await scrapeUrlSmart(job.url, { searchQuery });
    } catch (err) {
      return failJob(jobId, 'scraping', err, job.batchId);
    }

    // ─── 2. Parse computed styles ────────────────────
    await setJobStep(jobId, 'parsing-computed', { firecrawlDoneAt: new Date() });
    let computed: ComputedStyleSnapshot;
    try {
      computed = extractComputedStyles(scrape.html ?? '');
    } catch (err) {
      return failJob(jobId, 'parsing-computed', err, job.batchId);
    }

    // ─── 3. Gemini extraction ────────────────────────
    await setJobStep(jobId, 'extracting');
    try {
      brand = await extractBrandFromMarkdown({
        url: job.url,
        title: scrape.title,
        description: scrape.description,
        markdown: scrape.markdown,
        screenshotUrl: scrape.screenshotUrl,
        computed,
        branding: scrape.branding,
        designExtract: scrape.designExtract,
        gapHints,
        userFeedback: feedback,
      });
    } catch (err) {
      return failJob(jobId, 'extracting', err, job.batchId);
    }
  }

  // ─── 3b. Deterministic orphan resolution ─────────────
  // Auto-synthesise components for any color/typography token Gemini didn't
  // wire into a component. Cheap, runs in-process, kills the most common
  // linter warning category.
  await setJobStep(jobId, 'resolving-orphans', { geminiExtractDoneAt: new Date() });
  try {
    brand = resolveOrphans(brand);
  } catch (err) {
    return failJob(jobId, 'resolving-orphans', err, job.batchId);
  }

  // ─── 3c. Sparse-extraction guard ─────────────────────
  // Fail fast if Gemini returned too few tokens to produce a meaningful
  // DESIGN.md. Without this check, the author step silently writes a
  // near-empty spec that scores below 40 and stays invisible in the library.
  if (brand.colors.length < 3 || brand.typography.length < 2) {
    return failJob(
      jobId,
      'extracting',
      new Error(
        `Sparse extraction: ${brand.colors.length} color(s), ${brand.typography.length} typography token(s) — insufficient to author a meaningful DESIGN.md`,
      ),
      job.batchId,
    );
  }

  // ─── 4. Persist draft bundle ──────────────────────────
  await setJobStep(jobId, 'persisting');
  let bundleId: string;
  try {
    bundleId = await writeDraftBundle({ job, scrape, brand });
  } catch (err) {
    return failJob(jobId, 'persisting', err, job.batchId);
  }

  // ─── 5. Persist phase payload + hand off to Phase 2 / Phase 3 ────
  // Durably store everything the later workers need (trimmed markdown, brand,
  // draft bundleId, editor feedback) on the job row and advance phase→'author'
  // BEFORE enqueuing. Once this commits, the job is recoverable: if either
  // enqueue is lost, the supervisor re-enqueues phase 'author' with { jobId }
  // and the worker hydrates from phase_payload — no re-scrape.
  const phasePayload: AuthorPhasePayload = {
    bundleId,
    brand,
    scrapedMarkdown: scrape.markdown.slice(0, PHASE_2_MARKDOWN_CAP),
    designStyles: brand.designStyles ?? [],
    userFeedback: feedback ?? null,
  };
  try {
    await db
      .update(generationJobs)
      .set({ phase: 'author', phasePayload, status: 'running', updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  } catch (err) {
    return failJob(jobId, 'persisting', err, job.batchId);
  }

  // Author enqueue is required (no DESIGN.md without it). Companion enqueue is
  // best-effort — if QStash hiccups we log and continue; the supervisor will
  // re-dispatch the author phase and the bundle keeps its placeholder
  // companion until that worker runs.
  try {
    await enqueueTask('author-design-md', { jobId });
  } catch (err) {
    return failJob(jobId, 'enqueueing-author', err, job.batchId);
  }
  try {
    await enqueueTask('generate-companion', { jobId });
  } catch (err) {
    console.error('[scrape-and-extract] failed to enqueue companion task:', err);
    // Continue — the bundle has a placeholder companion; the worker can be
    // retried later or run from author-design-md as a future fallback.
  }

  // Phase 1 ends here. The job stays `running` with phase='author' until Phase
  // 2 picks it up (or the supervisor resumes it) and advances the step.
}

// ─── Helpers ─────────────────────────────────────────────────

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
    // If the per-stage telemetry columns don't exist yet (migration not
    // applied), retry without stamps so the pipeline keeps moving. Only
    // bail if even the bare update fails.
    if (!stamps) throw err;
    console.warn(
      `[scrape-and-extract] setJobStep with stamps failed (${err instanceof Error ? err.message : String(err)}) — retrying without telemetry columns`,
    );
    await db
      .update(generationJobs)
      .set({ status: 'running', currentStep: step, updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  }
}

async function failJob(jobId: string, step: string, err: unknown, batchId?: string | null): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[scrape-and-extract] job ${jobId} failed at ${step}:`, message);
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
  // Batch job failed → its slot is now free. Refill immediately rather than
  // waiting for the next cron tick. Best-effort: the supervisor backstops this.
  if (batchId) {
    await dispatchReady().catch((dispatchErr) =>
      console.error(`[scrape-and-extract] dispatchReady after fail (${jobId}) failed:`, dispatchErr),
    );
  }
}

async function writeDraftBundle(input: {
  job: typeof generationJobs.$inferSelect;
  scrape: ScrapeResult;
  brand: ExtractedBrand;
}): Promise<string> {
  const { job, scrape, brand } = input;
  const isUpload = job.sourceType === 'upload';
  // Upload jobs have no real URL — extractDomain would return the image hash,
  // which is meaningless to users. Fall back to the brand name as the slug
  // seed and leave sourceDomain/sourceUrl null on the bundle.
  const domain = isUpload ? '' : extractDomain(job.url);

  let primaryCategoryId: string | null = null;
  if (brand.category) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, brand.category))
      .limit(1);
    primaryCategoryId = cat?.id ?? null;
    if (!primaryCategoryId) {
      console.warn(
        `[scrape-and-extract] Gemini returned unknown category slug: "${brand.category}". ` +
          `Bundle will land uncategorized — check the enum in EXTRACTION_SCHEMA.`,
      );
    }
  }

  // Palette = role-bound colors (hex only, up to 6).
  const palette = brand.colors.slice(0, 6).map((c) => c.hex);
  const primary = brand.colors.find((c) => c.name === 'primary')?.hex ?? brand.colors[0]?.hex ?? null;

  const compatibleTools = ['claude', 'cursor', 'lovable', 'figma-make'];
  const description =
    brand.shortDescription.trim() || scrape.description || `${brand.name} — draft bundle.`;

  const placeholderCompanion = `# Draft companion prompt for ${brand.name}

Auto-generated placeholder. The pipeline replaces this with a tuned Sonnet prompt once the
canonical DESIGN.md is written.

Brand: ${brand.name}
Source: ${job.url}
`;

  // Re-run mode: UPDATE the existing bundle in place, preserving
  // editor-managed fields (title, description, license, attribution,
  // featured/curated, primaryCategoryId). Pipeline-managed fields are
  // overwritten with fresh extraction output.
  if (job.targetBundleId) {
    await db
      .update(bundles)
      .set({
        designMd: null,
        companionPrompt: placeholderCompanion,
        companionPromptVersion: 0,
        companionStatus: 'pending',
        designStyle: brand.designStyles,
        compatibleTools,
        sourceUrl: scrape.url,
        sourceUrlNormalized: job.normalizedUrl,
        sourceDomain: domain,
        authorName: brand.name,
        paletteColors: palette,
        brandLogoUrl: scrape.brandLogoUrl,
        brandInitial: brand.name ? brand.name.charAt(0).toUpperCase() : null,
        brandColor: primary,
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, job.targetBundleId));
    return job.targetBundleId;
  }

  const slug = await uniqueBundleSlug(brand.name || domain || 'upload');

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(bundles)
      .values({
        slug,
        title: brand.name || domain,
        description,
        type: 'design_md',
        designMd: null,
        companionPrompt: placeholderCompanion,
        companionPromptVersion: 0,
        companionStatus: 'pending',
        primaryCategoryId,
        designStyle: brand.designStyles,
        compatibleTools,
        status: 'personal',
        isCurated: false,
        isFeatured: false,
        createdBy: job.userId,
        // Uploads have no canonical source URL — leave attribution fields null.
        sourceUrl: isUpload ? null : scrape.url,
        sourceUrlNormalized: isUpload ? null : job.normalizedUrl,
        sourceDomain: isUpload ? null : domain,
        authorName: brand.name,
        paletteColors: palette,
        brandLogoUrl: scrape.brandLogoUrl,
        brandInitial: brand.name ? brand.name.charAt(0).toUpperCase() : null,
        brandColor: primary,
      })
      .returning({ id: bundles.id });
  } catch (err) {
    // Backstop for the uq_bundles_source_active guard: a concurrent job won
    // the race and already created an active bundle for this URL. The unique
    // index blocks the duplicate row; rather than fail, we attach this job to
    // the existing winner. (Uploads insert a NULL source URL and can't hit
    // the partial index, so this only applies to URL jobs.)
    if (!isUpload && job.normalizedUrl && isUniqueViolation(err)) {
      const [winner] = await db
        .select({ id: bundles.id })
        .from(bundles)
        .where(
          and(
            eq(bundles.sourceUrlNormalized, job.normalizedUrl),
            inArray(bundles.status, ['personal', 'pending_review', 'published', 'flagged']),
          ),
        )
        .limit(1);
      if (winner) {
        console.warn(
          `[scrape-and-extract] duplicate active bundle for ${job.normalizedUrl}; ` +
            `attaching job ${job.id} to existing bundle ${winner.id}`,
        );
        return winner.id;
      }
    }
    throw err;
  }

  if (!row) throw new Error('Failed to insert draft bundle');
  return row.id;
}

/**
 * Postgres unique-constraint violation (SQLSTATE 23505), as surfaced by the
 * postgres-js driver (errors carry a `.code` string).
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}
