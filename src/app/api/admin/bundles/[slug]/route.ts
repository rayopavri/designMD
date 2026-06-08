/**
 * /api/admin/bundles/[slug]
 *
 * GET   — full bundle detail for any status. Editor-only.
 * PATCH — update editable metadata (title, description, tags, category,
 *         feature/curated booleans, license, attribution). Editor-only.
 *
 * System-managed fields (designMd, companionPrompt, coverage*, status,
 * vote counts, source URL, palette) are NOT writable through PATCH.
 * Status changes go through the dedicated archive/restore/publish/reject
 * endpoints so each transition is explicit and auditable.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles, categories, users } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import {
  lintDesignMd,
  renderLintSummary,
  renderAccessibilityAdvisory,
} from '@/lib/generator/lint-design-md';
import { scoreFromLint } from '@/lib/generator/coverage';
import { appendWcagRows } from '@/lib/ai/generate-design-md';
import { normalizeUrl, extractDomain } from '@/lib/generator/url';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Programmatically-appended WCAG don't rows are tagged with this prefix so the
// re-lint-on-save flow can strip stale ones before re-appending — appendWcagRows
// is not idempotent and would otherwise duplicate them on every manual save.
const WCAG_ROW_RE = /^\|\s*⚠️ WCAG:.*\|\s*$/gm;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const DETAIL_COLUMNS = {
  id: bundles.id,
  slug: bundles.slug,
  title: bundles.title,
  description: bundles.description,
  type: bundles.type,
  status: bundles.status,
  designMd: bundles.designMd,
  companionPrompt: bundles.companionPrompt,
  companionStatus: bundles.companionStatus,
  coverageScore: bundles.coverageScore,
  coverageColors: bundles.coverageColors,
  coverageTypography: bundles.coverageTypography,
  coverageLayout: bundles.coverageLayout,
  coverageElevation: bundles.coverageElevation,
  coverageShapes: bundles.coverageShapes,
  coverageComponents: bundles.coverageComponents,
  coverageDosDonts: bundles.coverageDosDonts,
  primaryCategoryId: bundles.primaryCategoryId,
  primaryCategorySlug: categories.slug,
  primaryCategoryName: categories.name,
  designStyle: bundles.designStyle,
  compatibleTools: bundles.compatibleTools,
  paletteColors: bundles.paletteColors,
  brandLogoUrl: bundles.brandLogoUrl,
  brandInitial: bundles.brandInitial,
  brandColor: bundles.brandColor,
  sourceDomain: bundles.sourceDomain,
  sourceUrl: bundles.sourceUrl,
  authorName: bundles.authorName,
  // Creator attribution — distinct from authorName (which is the scraped
  // site's own attribution). Null for anonymously-generated bundles.
  createdBy: bundles.createdBy,
  creatorName: users.displayName,
  creatorEmail: users.email,
  license: bundles.license,
  attributionStatement: bundles.attributionStatement,
  isFeatured: bundles.isFeatured,
  isCurated: bundles.isCurated,
  reviewNotes: bundles.reviewNotes,
  accessibilityNotes: bundles.accessibilityNotes,
  voteCount: bundles.voteCount,
  positiveVoteRate: bundles.positiveVoteRate,
  submittedAt: bundles.submittedAt,
  reviewedAt: bundles.reviewedAt,
  publishedAt: bundles.publishedAt,
  createdAt: bundles.createdAt,
  updatedAt: bundles.updatedAt,
} as const;

async function loadBundle(slug: string) {
  const [row] = await db
    .select(DETAIL_COLUMNS)
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .leftJoin(users, eq(bundles.createdBy, users.id))
    .where(eq(bundles.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const row = await loadBundle(slug);
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: row });
}

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    sourceUrl: z.string().url().max(2000),
    brandLogoUrl: z.string().url().max(2000).nullable(),
    designMd: z.string().max(200_000),
    companionPrompt: z.string().min(1).max(200_000),
    designStyle: z.array(z.string().min(1).max(50)).max(20),
    compatibleTools: z.array(z.string().min(1).max(50)).max(20),
    primaryCategoryId: z.string().uuid().nullable(),
    license: z.string().min(1).max(100),
    attributionStatement: z.string().min(1).max(2000).nullable(),
    isFeatured: z.boolean(),
    isCurated: z.boolean(),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Verify primaryCategoryId points to a real category when provided.
  if (body.primaryCategoryId) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.primaryCategoryId))
      .limit(1);
    if (!cat) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
    }
  }

  // Build the update incrementally so field-specific side-effects (URL
  // normalization, design.md re-linting, companion version bump) only run for
  // the fields actually present in the request.
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };

  // Source URL — link only. Recompute the normalized dedup key + domain;
  // do NOT re-scrape (use the re-run pipeline action for that).
  if (typeof body.sourceUrl === 'string') {
    let normalized: string;
    let domain: string;
    try {
      normalized = normalizeUrl(body.sourceUrl);
      domain = extractDomain(body.sourceUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL — must be http or https' },
        { status: 400 },
      );
    }
    updates.sourceUrl = body.sourceUrl;
    updates.sourceUrlNormalized = normalized;
    updates.sourceDomain = domain;
  }

  // design.md — re-lint on save so coverage scores and review/accessibility
  // notes stay honest, mirroring the generation pipeline's lint→splice→score
  // step (src/lib/generator/author-design-md.ts). Status is intentionally left
  // untouched (the pipeline gates promotion on coverage; a manual edit must
  // not silently change a bundle's published/pending state).
  if (typeof body.designMd === 'string') {
    if (body.designMd.trim().length === 0) {
      // Editor cleared it — store null and leave coverage/notes as-is.
      updates.designMd = null;
    } else {
      // Strip any previously-appended WCAG rows before re-linting so repeated
      // saves don't accumulate duplicates (appendWcagRows is not idempotent),
      // then re-append fresh ones and score the spliced content for parity
      // with the pipeline (which scores post-splice).
      const stripped = body.designMd.replace(WCAG_ROW_RE, '').replace(/\n{3,}/g, '\n\n');
      let lintSummary;
      try {
        lintSummary = await lintDesignMd(stripped);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: 'Failed to lint design.md', details: msg },
          { status: 400 },
        );
      }
      const finalMd =
        lintSummary.derivedDonts.length > 0
          ? appendWcagRows(stripped, lintSummary.derivedDonts)
          : stripped;
      const coverage = scoreFromLint(lintSummary, finalMd);
      updates.designMd = finalMd;
      updates.coverageScore = coverage.overall;
      updates.coverageColors = coverage.colors;
      updates.coverageTypography = coverage.typography;
      updates.coverageLayout = coverage.layout;
      updates.coverageElevation = coverage.elevation;
      updates.coverageShapes = coverage.shapes;
      updates.coverageComponents = coverage.components;
      updates.coverageDosDonts = coverage.dosDonts;
      updates.reviewNotes = renderLintSummary(lintSummary);
      updates.accessibilityNotes = renderAccessibilityAdvisory(lintSummary);
    }
  }

  // Companion prompt — bump the version and stamp the editor so the manual
  // edit is auditable, and mark it ready.
  if (typeof body.companionPrompt === 'string') {
    const [cur] = await db
      .select({ v: bundles.companionPromptVersion })
      .from(bundles)
      .where(eq(bundles.slug, slug))
      .limit(1);
    if (!cur) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    updates.companionPrompt = body.companionPrompt;
    updates.companionPromptVersion = cur.v + 1;
    updates.companionPromptUpdatedAt = new Date();
    updates.companionPromptUpdatedBy = editor.id;
    updates.companionStatus = 'ready';
  }

  try {
    const result = await db
      .update(bundles)
      .set(updates)
      .where(eq(bundles.slug, slug))
      .returning({ id: bundles.id });
    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch (err) {
    // CHECK constraints (all_valid_design_styles, all_valid_tools) bubble
    // up as database errors with a recognizable message.
    const msg = err instanceof Error ? err.message : String(err);
    // Defensive: idx_bundles_source_normalized is currently a plain (non-unique)
    // index, so a colliding URL saves successfully today. Kept for the day it
    // becomes unique — dedup is advisory until then.
    if (/unique|duplicate key|idx_bundles_source_normalized/i.test(msg)) {
      return NextResponse.json(
        { error: 'Another bundle already uses this source URL' },
        { status: 409 },
      );
    }
    if (/chk_source_url/i.test(msg)) {
      return NextResponse.json({ error: 'Source URL failed validation' }, { status: 400 });
    }
    if (/all_valid_design_styles|all_valid_tools|check constraint/i.test(msg)) {
      return NextResponse.json(
        { error: 'Invalid value in designStyle or compatibleTools', details: msg },
        { status: 400 },
      );
    }
    console.error('[admin patch bundle]', err);
    return NextResponse.json({ error: 'Update failed', details: msg }, { status: 500 });
  }

  const row = await loadBundle(slug);
  return NextResponse.json({ data: row });
}
