/**
 * GET /api/categories
 *
 * Public listing of bundle categories (seeded + any added). Returns
 * minimal fields needed for dropdowns and filter UIs.
 */
import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function GET() {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      level: categories.level,
    })
    .from(categories)
    .orderBy(asc(categories.level), asc(categories.name));

  return NextResponse.json({ items: rows });
}
