/**
 * GET /api/admin/bundles
 *
 * Editor-only list endpoint covering ALL bundle statuses (personal,
 * pending_review, published, flagged, rejected, archived). Used by the
 * /admin/bundles management page.
 *
 * Query params (all optional):
 *   status        - comma-separated subset of the 6 statuses
 *   category      - category slug
 *   type          - 'design_md' | 'skill' | 'agent'
 *   designStyle   - comma-separated
 *   tools         - comma-separated
 *   q             - text search across title + description
 *   sort          - 'recent' (default) | 'top' (by coverageScore) | 'trending' (by submittedAt)
 *   cursor        - last bundle id from previous page
 *   limit         - default 30, max 60
 *
 * Response: { items: AdminBundleListItem[], nextCursor: string | null }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireEditor } from '@/lib/auth/session';
import { listAdminBundles } from '@/lib/db/queries/bundles';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set([
  'personal',
  'pending_review',
  'published',
  'flagged',
  'rejected',
  'archived',
]);

const VALID_TYPES = new Set(['design_md', 'skill', 'agent']);
const VALID_SORTS = new Set(['recent', 'top', 'trending', 'alpha']);

function parseCsv(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const url = new URL(req.url);
  const sp = url.searchParams;

  const rawStatus = parseCsv(sp.get('status'));
  const status = rawStatus?.filter((s) => VALID_STATUSES.has(s));

  const typeParam = sp.get('type');
  const type = typeParam && VALID_TYPES.has(typeParam) ? (typeParam as 'design_md' | 'skill' | 'agent') : undefined;

  const sortParam = sp.get('sort');
  const sort = sortParam && VALID_SORTS.has(sortParam) ? (sortParam as 'recent' | 'top' | 'trending' | 'alpha') : 'recent';

  const limitRaw = Number(sp.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(60, Math.floor(limitRaw)) : 30;

  const { items, nextCursor } = await listAdminBundles({
    status: status as ('personal' | 'pending_review' | 'published' | 'flagged' | 'rejected' | 'archived')[] | undefined,
    category: sp.get('category') ?? undefined,
    type,
    designStyle: parseCsv(sp.get('designStyle')),
    tools: parseCsv(sp.get('tools')),
    q: sp.get('q') ?? undefined,
    sort,
    cursor: sp.get('cursor') ?? undefined,
    limit,
  });

  return NextResponse.json({ items, nextCursor });
}
