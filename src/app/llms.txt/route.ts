/**
 * GET /llms.txt
 *
 * The emerging llms.txt convention (https://llmstxt.org): a plain-text,
 * markdown-formatted map of the site for LLMs and AI crawlers. Lists every
 * published design skill and links each to its clean-markdown representation
 * (/library/[slug]/raw), so an agent can discover and ingest the whole library
 * without executing JavaScript.
 */
import { listAllPublishedBundles } from '@/lib/db/queries/bundles';

const BASE = 'https://uiuxskills.com';

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function GET() {
  const bundles = await listAllPublishedBundles();

  const skillLines = bundles.map((b) => {
    const tools = b.compatibleTools.length > 0 ? ` (tools: ${b.compatibleTools.join(', ')})` : '';
    const desc = b.description ? `: ${truncate(b.description)}` : '';
    return `- [${b.title}](${BASE}/library/${b.slug}/raw)${desc}${tools}`;
  });

  const doc = [
    '# UIUXskills',
    '',
    '> Curated design skills paired with calibrated Claude prompts. Each design skill is a DESIGN.md spec plus a companion system prompt that makes AI coding tools (Claude, Cursor, Lovable, Figma Make) generate on-brand UI for a specific brand or design system.',
    '',
    'Browse a searchable library of design skills, or generate a new one from any URL. Every skill has a clean-markdown version — append `/raw` to any library URL (already done in the links below).',
    '',
    '## Design skills',
    '',
    ...(skillLines.length > 0 ? skillLines : ['- (No published design skills yet.)']),
    '',
    '## Site',
    '',
    `- [Design skill library](${BASE}/library): browse and search every design skill`,
    `- [Generate a design skill](${BASE}/generate): create a new one from any URL`,
    `- [Attribution & licensing](${BASE}/legal/attribution): how sources are credited`,
    '',
  ].join('\n');

  return new Response(doc, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
