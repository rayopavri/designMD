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
 * Splitting was forced by Vercel Hobby's 60s function cap — the Sonnet
 * call alone takes 25-35s. Phase 1 enqueues Phase 2 via QStash and
 * passes the full brand object + trimmed scrape markdown in the payload.
 */
import { eq } from 'drizzle-orm';
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
import { advanceBatch } from '@/lib/generator/batch';

// QStash payloads are capped at 1MB. Trim the scraped markdown before
// passing to Phase 2 — design.md authoring only needs a representative
// chunk of the page text. 40k chars ≈ 10k tokens which is plenty for
// Sonnet's context.
const PHASE_2_MARKDOWN_CAP = 40_000;

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
      if ((cov.coverageElevation ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Elevation: describe shadow scale, z-index layers, depth hierarchy');
        searchTerms.push('elevation shadow depth');
      }
      if ((cov.coverageShapes ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Shapes: extract border-radius tokens at each scale (sm, md, lg, full)');
        searchTerms.push('shapes radius corners');
      }
      if ((cov.coverageComponents ?? 0) < GAP_THRESHOLD) {
        gaps.push('- Components: identify buttons, cards, inputs, badges, navigation with full token specs');
        searchTerms.push('components buttons forms inputs');
      }
      if ((cov.coverageDosDonts ?? 0) < GAP_THRESHOLD) {
        gaps.push("- Do's and Don'ts: extract at least 3 dos and 3 don'ts for using this design system");
        searchTerms.push('guidelines usage rules');
      }

      if (gaps.length > 0) {
        gapHints = gaps.join('\n');
        searchQuery = searchTerms.join(' ');
      }
    }
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

  // ─── 4. Persist draft bundle ──────────────────────────
  await setJobStep(jobId, 'persisting');
  let bundleId: string;
  try {
    bundleId = await writeDraftBundle({ job, scrape, brand });
  } catch (err) {
    return failJob(jobId, 'persisting', err, job.batchId);
  }

  // ─── 5. Hand off to Phase 2 + Phase 3 in parallel ────
  // The companion-prompt worker only needs the brand JSON (not the finished
  // DESIGN.md), so we fire it alongside the author worker rather than
  // chaining it after Sonnet returns. Both run in separate Vercel functions
  // to stay under the 60s Hobby cap. QStash payloads cap at 1MB; trim
  // markdown again from 80k → 40k to keep the author payload small.
  //
  // Author enqueue is required (no DESIGN.md without it). Companion enqueue
  // is best-effort — if QStash hiccups we log and continue, matching the
  // legacy behavior from author-design-md.ts where companion was fired
  // with try/catch + log on failure.
  try {
    await enqueueTask('author-design-md', {
      jobId,
      bundleId,
      url: job.url,
      scrapedMarkdown: scrape.markdown.slice(0, PHASE_2_MARKDOWN_CAP),
      brand,
      isRerun: Boolean(job.targetBundleId),
      autoPublish: Boolean(job.autoPublish),
      batchId: job.batchId ?? null,
    });
  } catch (err) {
    return failJob(jobId, 'enqueueing-author', err, job.batchId);
  }
  try {
    await enqueueTask('generate-companion', {
      bundleId,
      jobId,
      brand,
      designStyles: brand.designStyles ?? [],
    });
  } catch (err) {
    console.error('[scrape-and-extract] failed to enqueue companion task:', err);
    // Continue — the bundle has a placeholder companion; the worker can be
    // retried later or run from author-design-md as a future fallback.
  }

  // Phase 1 ends here. The job stays `running` with currentStep='persisting'
  // until Phase 2 picks it up and advances to 'writing-design-md'.
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
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  await advanceBatch(batchId);
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
      brandLogoUrl: scrape.brandLogoUrl,
      brandInitial: brand.name ? brand.name.charAt(0).toUpperCase() : null,
      brandColor: primary,
    })
    .returning({ id: bundles.id });

  if (!row) throw new Error('Failed to insert draft bundle');
  return row.id;
}
