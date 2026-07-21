/**
 * GET /library/[slug]/raw
 *
 * The clean-markdown representation of a published design skill: the DESIGN.md
 * spec plus its companion prompt, wrapped in a small metadata header. This is
 * the endpoint AI crawlers/agents (and the `text/markdown` alternate on the
 * detail page + llms.txt) point at — plain text, no JS, trivially ingestible
 * and citable. Only published bundles are served; drafts 404.
 */
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';

// Refresh hourly; the underlying spec changes infrequently.
export const revalidate = 3600;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return new Response('Invalid slug', { status: 400 });
  }

  const bundle = await getVisibleBundleBySlug(slug);
  if (!bundle || bundle.status !== 'published') {
    return new Response('Not found', { status: 404 });
  }

  const canonical = `https://uiuxskills.com/library/${slug}`;
  const tools = bundle.compatibleTools.length > 0 ? bundle.compatibleTools.join(', ') : '—';

  const header = [
    `# ${bundle.title} — Design System`,
    '',
    `> ${bundle.description}`,
    '',
    `- **Canonical:** ${canonical}`,
    bundle.sourceUrl ? `- **Source:** ${bundle.sourceUrl}` : null,
    bundle.primaryCategoryName ? `- **Category:** ${bundle.primaryCategoryName}` : null,
    `- **Compatible tools:** ${tools}`,
    bundle.coverageScore != null ? `- **Coverage:** ${bundle.coverageScore}%` : null,
    `- **License:** ${bundle.license ?? 'MIT'}`,
    `- **Last updated:** ${bundle.updatedAt.toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const sections = [header, '', '---', ''];

  if (bundle.designMd) {
    sections.push(bundle.designMd.trim(), '');
  } else {
    sections.push('_The DESIGN.md for this skill is still being generated._', '');
  }

  if (bundle.companionPrompt && bundle.companionStatus !== 'pending') {
    sections.push('---', '', '## Companion prompt', '', bundle.companionPrompt.trim(), '');
  }

  const body = sections.join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Cache at the edge; the detail page's data changes infrequently.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
