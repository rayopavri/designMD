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
import { scrapeUrl, type ScrapeResult } from '@/lib/ai/firecrawl';
import { enqueueTask } from '@/lib/queue';
import {
  extractComputedStyles,
  type ComputedStyleSnapshot,
} from '@/lib/generator/extract-computed-styles';
import { resolveOrphans } from '@/lib/generator/resolve-orphans';
import { extractDomain } from '@/lib/generator/url';
import { uniqueBundleSlug } from '@/lib/generator/slug';
import { uploadScreenshotToBlob } from '@/lib/generator/upload-screenshot';

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

  // ─── 5. Hand off to Phase 2 ────────────────────────────
  // Sonnet design.md + lint + score run in a separate Vercel function
  // to stay under the 60s Hobby cap. Pass everything Phase 2 needs in
  // the QStash payload — brand JSON + trimmed scraped markdown. We
  // already truncated markdown to 80k in firecrawl.ts; trim again to
  // 40k for the cross-function hop so the QStash payload stays small.
  try {
    await enqueueTask('author-design-md', {
      jobId,
      bundleId,
      url: job.url,
      scrapedMarkdown: scrape.markdown.slice(0, PHASE_2_MARKDOWN_CAP),
      brand,
      isRerun: Boolean(job.targetBundleId),
    });
  } catch (err) {
    return failJob(jobId, 'enqueueing-author', err);
  }

  // Phase 1 ends here. The job stays `running` with currentStep='persisting'
  // until Phase 2 picks it up and advances to 'writing-design-md'.
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

  const screenshotBlobUrl = await uploadScreenshotToBlob({
    screenshotUrl: scrape.screenshotUrl,
    slugHint: brand.name || domain || 'bundle',
  });

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
        // Only overwrite the screenshot when the new upload succeeded —
        // a stale thumbnail is better than no thumbnail.
        ...(screenshotBlobUrl ? { screenshotUrl: screenshotBlobUrl } : {}),
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
      screenshotUrl: screenshotBlobUrl,
    })
    .returning({ id: bundles.id });

  if (!row) throw new Error('Failed to insert draft bundle');
  return row.id;
}
