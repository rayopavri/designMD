/**
 * POST /api/admin/categories
 * Editor-only. Creates a new top-level (level 1) category.
 * Body: { name: string }
 * Returns: { data: { id, slug, name, level } }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';

export const runtime = 'nodejs';

const BodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
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

  const slug = toSlug(body.name);
  if (!slug) {
    return NextResponse.json(
      { error: 'Name must contain alphanumeric characters' },
      { status: 400 },
    );
  }

  try {
    const [row] = await db
      .insert(categories)
      .values({ name: body.name, slug, level: 1 })
      .returning({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        level: categories.level,
      });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate key/i.test(msg)) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Failed to create category', details: msg }, { status: 500 });
  }
}
