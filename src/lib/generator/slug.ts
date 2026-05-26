/**
 * Slug generation for new bundles.
 *
 * Strategy:
 *   1. Start from the brand name (or root domain if name is missing).
 *   2. Slugify to lowercase kebab-case ASCII.
 *   3. If the slug already exists in the bundles table, suffix "-2", "-3", ...
 *      until it's unique. Caller is responsible for the existence check.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'bundle';
}

export async function uniqueBundleSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  while (true) {
    const [hit] = await db
      .select({ id: bundles.id })
      .from(bundles)
      .where(eq(bundles.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    candidate = `${root}-${n++}`;
    if (n > 99) throw new Error(`Could not find a unique slug for ${base}`);
  }
}
