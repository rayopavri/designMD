import type { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listCategoriesWithPublishedCounts } from '@/lib/db/queries/bundles';
import { TOOL_LANDINGS } from '@/lib/ui-data/landing';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [published, categories] = await Promise.all([
    db
      .select({ slug: bundles.slug, updatedAt: bundles.updatedAt })
      .from(bundles)
      .where(eq(bundles.status, 'published')),
    listCategoriesWithPublishedCounts(),
  ]);

  const bundleUrls: MetadataRoute.Sitemap = published.map((b) => ({
    url: `https://uiuxskills.com/library/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `https://uiuxskills.com/library/category/${c.slug}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const toolUrls: MetadataRoute.Sitemap = TOOL_LANDINGS.map((t) => ({
    url: `https://uiuxskills.com/for/${t.slug}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [
    { url: 'https://uiuxskills.com', changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://uiuxskills.com/library', changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://uiuxskills.com/generate', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://uiuxskills.com/legal/privacy', changeFrequency: 'yearly', priority: 0.2 },
    { url: 'https://uiuxskills.com/legal/terms', changeFrequency: 'yearly', priority: 0.2 },
    { url: 'https://uiuxskills.com/legal/attribution', changeFrequency: 'yearly', priority: 0.1 },
    ...categoryUrls,
    ...toolUrls,
    ...bundleUrls,
  ];
}
