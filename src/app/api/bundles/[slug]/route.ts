/**
 * GET /api/bundles/[slug]
 *
 * Returns the full BundleDetail for a published bundle, or 404.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getPublishedBundleBySlug } from '@/lib/db/queries/bundles';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  const bundle = await getPublishedBundleBySlug(slug);
  if (!bundle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: bundle });
}
