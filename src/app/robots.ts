import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/library/', '/generate'],
        disallow: ['/api/', '/admin/', '/account/', '/_next/'],
      },
    ],
    sitemap: 'https://uiuxskills.com/sitemap.xml',
  };
}
