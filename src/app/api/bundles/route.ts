/**
 * GET /api/bundles
 *
 * Query params:
 *   category=<slug>            primary category slug
 *   type=design_md|skill|agent
 *   designStyle=dark-mode,bold (comma-separated)
 *   tools=claude,cursor        (comma-separated)
 *   q=<text>                   search query
 *   sort=recent|top|trending   default: recent
 *   limit=<n>                  default 24, max 60
 *   cursor=<bundleId>          opaque pagination cursor
 *
 * Returns: { data: BundleListItem[], meta: { nextCursor } }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listPublishedBundles } from '@/lib/db/queries/bundles';

const QuerySchema = z.object({
  category: z.string().min(1).max(64).optional(),
  type: z.enum(['design_md', 'skill', 'agent']).optional(),
  designStyle: z.string().optional(),
  tools: z.string().optional(),
  q: z.string().max(120).optional(),
  sort: z.enum(['recent', 'top', 'trending']).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  cursor: z.string().uuid().optional(),
});

function csvToArray(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const arr = v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    category: sp.get('category') ?? undefined,
    type: sp.get('type') ?? undefined,
    designStyle: sp.get('designStyle') ?? undefined,
    tools: sp.get('tools') ?? undefined,
    q: sp.get('q') ?? undefined,
    sort: sp.get('sort') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items, nextCursor } = await listPublishedBundles({
    category: parsed.data.category,
    type: parsed.data.type,
    designStyle: csvToArray(parsed.data.designStyle),
    tools: csvToArray(parsed.data.tools),
    q: parsed.data.q,
    sort: parsed.data.sort,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
  });

  return NextResponse.json({ data: items, meta: { nextCursor } });
}
