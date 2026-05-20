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
import { bundles, categories } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';

export const runtime = 'nodejs';

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
  sourceDomain: bundles.sourceDomain,
  sourceUrl: bundles.sourceUrl,
  authorName: bundles.authorName,
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

  try {
    const result = await db
      .update(bundles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(bundles.slug, slug))
      .returning({ id: bundles.id });
    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch (err) {
    // CHECK constraints (all_valid_design_styles, all_valid_tools) bubble
    // up as database errors with a recognizable message.
    const msg = err instanceof Error ? err.message : String(err);
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
