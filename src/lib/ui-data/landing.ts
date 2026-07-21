/**
 * Static definitions for the tool landing pages (/for/[tool]).
 *
 * `slug` doubles as the URL segment and the DB `compatible_tools` value, so
 * the page can filter bundles directly. Server-safe (pure data), imported by
 * the /for/[tool] route, the sitemap, and the footer's internal links.
 */
export interface ToolLanding {
  slug: string;
  name: string;
  /** SEO <title> / H1 fragment, e.g. "for Cursor". */
  title: string;
  /** One-paragraph intro shown on the page and used as the meta description. */
  blurb: string;
}

export const TOOL_LANDINGS: ToolLanding[] = [
  {
    slug: 'claude',
    name: 'Claude',
    title: 'Design systems for Claude',
    blurb:
      'Drop a DESIGN.md spec and its companion prompt into Claude and it ships on-brand UI — matching a real brand’s colors, typography, spacing, and components instead of generic defaults.',
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    title: 'Design systems for Cursor',
    blurb:
      'Give Cursor a DESIGN.md spec and companion prompt so its generated components follow a real brand’s design system — palette, type scale, spacing, and dos and don’ts — from the first pass.',
  },
  {
    slug: 'lovable',
    name: 'Lovable',
    title: 'Design systems for Lovable',
    blurb:
      'Paste a DESIGN.md spec and companion prompt into Lovable to build apps that look intentionally designed — on-brand color, typography, and components rather than the default template look.',
  },
  {
    slug: 'figma-make',
    name: 'Figma Make',
    title: 'Design systems for Figma Make',
    blurb:
      'Feed Figma Make a DESIGN.md spec and companion prompt so its output matches a specific brand’s design system — tokens, type, spacing, and component rules — instead of generic UI.',
  },
];

export function getToolLanding(slug: string): ToolLanding | undefined {
  return TOOL_LANDINGS.find((t) => t.slug === slug);
}
