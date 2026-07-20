import type { MetadataRoute } from 'next';

// Non-content areas — no reason for any crawler to spend budget here.
const DISALLOW = ['/api/', '/admin/', '/account/', '/_next/'];

// AI crawlers we explicitly welcome (search + training/answer engines). They
// respect robots.txt and mostly don't execute JavaScript, which is why the
// library and bundle pages are server-rendered and also exposed as markdown
// via /llms.txt and /library/[slug]/raw.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: AI_BOTS,
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: 'https://uiuxskills.com/sitemap.xml',
    host: 'https://uiuxskills.com',
  };
}
