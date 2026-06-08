/**
 * GET /api/bundles/[slug]/related
 *
 * Returns up to 6 published bundles related to the given bundle by
 * primary category, design style, or compatible tool. Always returns a
 * (possibly empty) list — an unknown slug yields `{ data: [] }`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getRelatedBundles } from '@/lib/db/queries/bundles';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  const { items, sourceCategoryName, sourceCategorySlug } = await getRelatedBundles(slug);
  return NextResponse.json({ data: items, sourceCategoryName, sourceCategorySlug });
}
