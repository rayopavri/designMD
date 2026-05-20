/**
 * GET /api/admin/bundles/[slug]
 *
 * Editor-only. Returns the full bundle detail for any status — used by
 * the reviewer queue UI to inspect design.md + companion prompt before
 * approving or rejecting.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
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

  const [row] = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      type: bundles.type,
      status: bundles.status,
      designMd: bundles.designMd,
      companionPrompt: bundles.companionPrompt,
      coverageScore: bundles.coverageScore,
      coverageColors: bundles.coverageColors,
      coverageTypography: bundles.coverageTypography,
      coverageLayout: bundles.coverageLayout,
      coverageElevation: bundles.coverageElevation,
      coverageShapes: bundles.coverageShapes,
      coverageComponents: bundles.coverageComponents,
      coverageDosDonts: bundles.coverageDosDonts,
      primaryCategorySlug: categories.slug,
      primaryCategoryName: categories.name,
      designStyle: bundles.designStyle,
      compatibleTools: bundles.compatibleTools,
      paletteColors: bundles.paletteColors,
      sourceDomain: bundles.sourceDomain,
      sourceUrl: bundles.sourceUrl,
      authorName: bundles.authorName,
      license: bundles.license,
      reviewNotes: bundles.reviewNotes,
      submittedAt: bundles.submittedAt,
      createdAt: bundles.createdAt,
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: row });
}
