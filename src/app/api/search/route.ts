/**
 * GET /api/search?q=...
 *
 * Full-text search across published bundles via the Orama in-memory index.
 * Falls back to a DB ilike query when the index fails so the UI keeps working.
 * Minimum query: 2 chars. Maximum: 120.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { searchBundles } from '@/lib/search';
import { listPublishedBundles } from '@/lib/db/queries/bundles';
import { rateLimitByIp, tooManyRequests } from '@/lib/rate-limit/by-ip';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rl = await rateLimitByIp(req, { limit: 30, window: '1 m', prefix: 'rl:search' });
  if (!rl.ok) return tooManyRequests(rl);

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ error: 'query_too_short' }, { status: 400 });
  }
  if (q.length > 120) {
    return NextResponse.json({ error: 'query_too_long' }, { status: 400 });
  }

  try {
    const hits = await searchBundles(q);
    return NextResponse.json({ data: hits });
  } catch (err) {
    console.error('[search] Orama error, falling back to DB:', err);
    const { items } = await listPublishedBundles({ q, limit: 30 });
    const fallback = items.map((b) => ({
      slug: b.slug,
      title: b.title,
      description: b.description,
      score: 1,
    }));
    return NextResponse.json({ data: fallback });
  }
}
