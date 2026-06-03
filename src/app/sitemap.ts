import type { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = await db
    .select({ slug: bundles.slug, updatedAt: bundles.updatedAt })
    .from(bundles)
    .where(eq(bundles.status, 'published'));

  const bundleUrls: MetadataRoute.Sitemap = published.map((b) => ({
    url: `https://uiuxskills.com/library/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    { url: 'https://uiuxskills.com', changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://uiuxskills.com/library', changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://uiuxskills.com/generate', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://uiuxskills.com/legal/privacy', changeFrequency: 'yearly', priority: 0.2 },
    { url: 'https://uiuxskills.com/legal/terms', changeFrequency: 'yearly', priority: 0.2 },
    { url: 'https://uiuxskills.com/legal/attribution', changeFrequency: 'yearly', priority: 0.1 },
    ...bundleUrls,
  ];
}
