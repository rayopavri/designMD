/**
 * Pipeline worker — canonical Google DESIGN.md aligned.
 *
 * Steps:
 *   scraping             → Firecrawl renders the URL
 *   parsing-computed     → pull CSS vars + dominant hexes + tailwind classes from HTML
 *   extracting           → Gemini Flash (vision + computed): structured tokens + prose context
 *   persisting           → write draft bundle (status=personal) for failure isolation
 *   writing-design-md    → Sonnet 4.6: YAML front-matter + canonical markdown body
 *   linting              → @google/design.md linter parses & validates
 *   self-heal (optional) → if WCAG fails, re-prompt Sonnet with derived donts
 *   writing-companion    → Sonnet 4.6: tool-agnostic companion prompt
 *   scoring              → coverage scorer derives 7 section scores from linter model
 *   ready_for_review     → promote bundle status to pending_review
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories, generationJobs } from '@/lib/db/schema';
import {
  extractBrandFromImage,
  extractBrandFromMarkdown,
  type ExtractedBrand,
} from '@/lib/ai/gemini';
import { scrapeUrl, type ScrapeResult } from '@/lib/ai/firecrawl';
import { generateDesignMd } from '@/lib/ai/generate-design-md';
import { enqueueTask } from '@/lib/queue';
import { scoreFromLint } from '@/lib/generator/coverage';
import {
  extractComputedStyles,
  type ComputedStyleSnapshot,
} from '@/lib/generator/extract-computed-styles';
import {
  lintDesignMd,
  renderAccessibilityAdvisory,
  renderLintSummary,
  type LintSummary,
} from '@/lib/generator/lint-design-md';
import { resolveOrphans } from '@/lib/generator/resolve-orphans';
import { extractDomain } from '@/lib/generator/url';
import { uniqueBundleSlug } from '@/lib/generator/slug';

export interface ScrapeAndExtractPayload {
  jobId: string;
}

export async function runScrapeAndExtract(payload: ScrapeAndExtractPayload): Promise<void> {
  const { jobId } = payload;

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  if (!job) throw new Error(`generation job ${jobId} not found`);
  if (job.status !== 'queued' && job.status !== 'running') return;

  const isUpload = job.sourceType === 'upload';

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
      language: null,
      statusCode: null,
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
      return failJob(jobId, 'extracting', err);
    }
  } else {
    // ─── 1. Scrape ───────────────────────────────────
    await setJobStep(jobId, 'scraping');
    try {
      scrape = await scrapeUrl(job.url);
    } catch (err) {
      return failJob(jobId, 'scraping', err);
    }

    // ─── 2. Parse computed styles ────────────────────
    await setJobStep(jobId, 'parsing-computed');
    let computed: ComputedStyleSnapshot;
    try {
      computed = extractComputedStyles(scrape.html ?? '');
    } catch (err) {
      return failJob(jobId, 'parsing-computed', err);
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
      });
    } catch (err) {
      return failJob(jobId, 'extracting', err);
    }
  }

  // ─── 3b. Deterministic orphan resolution ─────────────
  // Auto-synthesise components for any color/typography token Gemini didn't
  // wire into a component. Cheap, runs in-process, kills the most common
  // linter warning category.
  await setJobStep(jobId, 'resolving-orphans');
  try {
    brand = resolveOrphans(brand);
  } catch (err) {
    return failJob(jobId, 'resolving-orphans', err);
  }

  // ─── 4. Persist draft bundle ──────────────────────────
  await setJobStep(jobId, 'persisting');
  let bundleId: string;
  try {
    bundleId = await writeDraftBundle({ job, scrape, brand });
  } catch (err) {
    return failJob(jobId, 'persisting', err);
  }

  // ─── 5. Sonnet writes canonical design.md ─────────────
  await setJobStep(jobId, 'writing-design-md');
  let designMdContent: string;
  try {
    const generated = await generateDesignMd({
      brand,
      url: job.url,
      scrapedMarkdown: scrape.markdown,
    });
    designMdContent = generated.content;
  } catch (err) {
    return failJob(jobId, 'writing-design-md', err);
  }

  // ─── 5b. Persist designMd to DB + fire companion task NOW ────
  // The companion worker only needs designMd + brand info — it doesn't
  // wait on lint or scoring. Kicking it off here lets it run in parallel
  // with the remaining ~3-4s of lint+score+final-persist, cutting
  // wall-clock time-to-companion-ready by ~10s.
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
    return failJob(jobId, 'persisting-design-md', err);
  }
  try {
    await enqueueTask('generate-companion', { bundleId });
  } catch (err) {
    console.error('[scrape-and-extract] failed to enqueue companion task:', err);
    // Continue — the bundle has design.md; companion can be retried later.
  }

  // ─── 6. Lint with official linter ─────────────────────
  await setJobStep(jobId, 'linting');
  let lintSummary: LintSummary;
  try {
    lintSummary = await lintDesignMd(designMdContent);
  } catch (err) {
    return failJob(jobId, 'linting', err);
  }

  // Self-heal loops (WCAG retry + orphan retry) removed for free-tier
  // Vercel 60s budget. Lint failures still surface to the editor via
  // reviewNotes + score penalty (wcagFactor in coverage.ts). The bundle
  // is held as `personal` instead of being promoted to `pending_review`
  // when failures exist, so low-quality output doesn't pollute the queue.

  // ─── 7. Score from linter model ──────────────────────
  // (Companion prompt was previously here; moved to a second worker
  // function — see /api/internal/tasks/generate-companion. This keeps
  // the main pipeline under Vercel Hobby's 60s budget.)
  await setJobStep(jobId, 'scoring');
  const coverage = scoreFromLint(lintSummary, designMdContent);

  // ─── 8. Persist & quality-gated promotion ─────────────
  // Gate: bundles with errors OR overall score < 40 stay personal so the
  // editor queue isn't polluted with low-quality drafts. The user can
  // still find them in their /account drafts.
  //
  // Re-run mode: skip the quality gate. The editor already curated this
  // bundle and explicitly asked for a refresh — don't demote a published
  // bundle to personal just because the new lint output dipped below 40.
  const isRerun = Boolean(job.targetBundleId);
  const shouldPromote =
    lintSummary.counts.errors === 0 &&
    coverage.overall >= 40;

  try {
    await db
      .update(bundles)
      .set({
        // designMd + companionStatus already written in step 5b above.
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
        // On re-run, leave existing status/submittedAt alone.
        ...(isRerun
          ? {}
          : {
              status: shouldPromote ? ('pending_review' as const) : ('personal' as const),
              submittedAt: shouldPromote ? new Date() : null,
            }),
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, bundleId));
  } catch (err) {
    return failJob(jobId, 'scoring', err);
  }

  await db
    .update(generationJobs)
    .set({
      status: 'completed',
      currentStep: isRerun
        ? 'rerun_complete'
        : shouldPromote
          ? 'ready_for_review'
          : 'held_as_draft',
      resultBundleId: bundleId,
      // Drop the base64 payload once the bundle is persisted — we don't need
      // to keep the original image around (per design spec).
      imageData: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
}

// ─── Helpers ─────────────────────────────────────────────────

async function setJobStep(jobId: string, step: string): Promise<void> {
  await db
    .update(generationJobs)
    .set({ status: 'running', currentStep: step, updatedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
}

async function failJob(jobId: string, step: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[scrape-and-extract] job ${jobId} failed at ${step}:`, message);
  await db
    .update(generationJobs)
    .set({
      status: 'failed',
      errorStep: step,
      errorMessage: message.slice(0, 1000),
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
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
        brandInitial: brand.name ? brand.name.charAt(0).toUpperCase() : null,
        brandColor: primary,
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, job.targetBundleId));
    return job.targetBundleId;
  }

  const slug = await uniqueBundleSlug(brand.name || domain || 'upload');

  const [row] = await db
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
      brandInitial: brand.name ? brand.name.charAt(0).toUpperCase() : null,
      brandColor: primary,
    })
    .returning({ id: bundles.id });

  if (!row) throw new Error('Failed to insert draft bundle');
  return row.id;
}
