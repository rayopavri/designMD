/**
 * POST /api/admin/bundles/bulk-reject
 *
 * Editor-only. Rejects up to 50 bundles in one pass. Skips already-rejected
 * bundles (idempotent). Returns 409 if any selected bundle is published.
 *
 * Body: { slugs: string[], reviewNotes: string }   (1–50 slugs, notes 1–2000 chars)
 *
 * Response: { ok: true, rejected: number, skipped: number, notFound: string[] }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { invalidateSearchIndex } from '@/lib/search';

export const runtime = 'nodejs';

const BodySchema = z.object({
  slugs: z
    .array(z.string().min(1).max(120))
    .min(1, 'Provide at least one slug.')
    .max(50, 'Maximum 50 slugs per request.'),
  reviewNotes: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const { slugs, reviewNotes } = body;

  const found = await db
    .select({ id: bundles.id, slug: bundles.slug, status: bundles.status })
    .from(bundles)
    .where(inArray(bundles.slug, slugs));

  const foundSlugs = new Set(found.map((r) => r.slug));
  const notFound = slugs.filter((s) => !foundSlugs.has(s));

  // Block the whole batch if any selected bundle is published.
  const published = found.filter((r) => r.status === 'published');
  if (published.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot reject published bundles; archive them instead. Published: ${published.map((r) => r.slug).join(', ')}`,
      },
      { status: 409 },
    );
  }

  const toReject = found.filter((r) => r.status !== 'rejected');
  const skipped = found.length - toReject.length;

  if (toReject.length > 0) {
    const ids = toReject.map((r) => r.id);
    await db
      .update(bundles)
      .set({
        status: 'rejected',
        reviewedBy: editor.id,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(inArray(bundles.id, ids));
    invalidateSearchIndex();
  }

  return NextResponse.json({ ok: true, rejected: toReject.length, skipped, notFound });
}
