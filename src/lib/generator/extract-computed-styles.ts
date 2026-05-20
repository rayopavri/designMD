/**
 * Computed-style extraction from scraped HTML.
 *
 * Reads CSS custom properties, inline styles, and class names off the
 * rendered HTML to produce a deterministic snapshot of the brand's
 * actual design tokens — independent of the text content.
 *
 * Returned to the Sonnet design.md generator as structured ground
 * truth, alongside the AI vision extraction. This is the closest we
 * can get to Stitch's DOM & CSS extraction stage without a real
 * headless browser inspection.
 */
import { parse, type HTMLElement } from 'node-html-parser';
import { tallyHexes } from './color-utils';

export interface ComputedStyleSnapshot {
  cssVariables: Record<string, string>;
  /** Most frequently used hex colors across all CSS we could see. */
  dominantHexes: string[];
  /** Top tailwind-shaped class names (e.g. "bg-slate-900", "text-blue-500"). */
  tailwindClassesByCategory: {
    colors: string[];
    spacing: string[];
    typography: string[];
    radius: string[];
    shadow: string[];
  };
  /** Font families discovered in font-family declarations. */
  fontFamilies: string[];
  /** Number of bytes of CSS we parsed. Useful for the reviewer to gauge confidence. */
  cssBytesAnalysed: number;
}

const CSS_VAR_RE = /--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+?)\s*(?:;|\})/g;
const FONT_FAMILY_RE = /font-family\s*:\s*([^;}]+)/gi;

const TAILWIND_PREFIXES = {
  colors: /^(bg|text|border|ring|fill|stroke|from|to|via)-/,
  spacing: /^(p[trblxy]?|m[trblxy]?|gap|space-[xy])-/,
  typography: /^(text-(?:xs|sm|base|lg|xl|[0-9]xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-|tracking-)/,
  radius: /^rounded(-[trblse]+)?(-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/,
  shadow: /^shadow(-(?:none|sm|md|lg|xl|2xl|inner))?$/,
} as const;

export function extractComputedStyles(html: string): ComputedStyleSnapshot {
  const root = parse(html);

  // 1. Concatenate every CSS source we can see (style blocks + inline).
  const styleBlocks = root.querySelectorAll('style').map((s) => s.textContent);
  const inlineStyles = root.querySelectorAll('[style]').map((el: HTMLElement) => el.getAttribute('style') ?? '');
  const allCss = [...styleBlocks, ...inlineStyles].join('\n');

  // 2. CSS custom properties (--*).
  const cssVariables: Record<string, string> = {};
  for (const m of allCss.matchAll(CSS_VAR_RE)) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (value && !cssVariables[name]) {
      cssVariables[name] = value;
    }
  }

  // 3. Dominant hex colors by frequency across all CSS.
  const tallies = tallyHexes(allCss);
  const dominantHexes = Object.entries(tallies)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([hex]) => hex);

  // 4. Font families from font-family declarations.
  const fontSet = new Set<string>();
  for (const m of allCss.matchAll(FONT_FAMILY_RE)) {
    for (const family of m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))) {
      if (family && !family.startsWith('var(') && family.length < 40) {
        fontSet.add(family);
      }
    }
  }

  // 5. Tailwind-shaped class names from class= attributes.
  const allClasses = collectAllClassNames(root);
  const tailwindClassesByCategory = bucketTailwindClasses(allClasses);

  return {
    cssVariables,
    dominantHexes,
    tailwindClassesByCategory,
    fontFamilies: Array.from(fontSet).slice(0, 6),
    cssBytesAnalysed: allCss.length,
  };
}

function collectAllClassNames(root: HTMLElement): string[] {
  const tally: Record<string, number> = {};
  for (const el of root.querySelectorAll('[class]')) {
    const cls = el.getAttribute('class') ?? '';
    for (const c of cls.split(/\s+/)) {
      if (!c || c.length > 40) continue;
      tally[c] = (tally[c] ?? 0) + 1;
    }
  }
  return Object.entries(tally)
    .sort(([, a], [, b]) => b - a)
    .map(([c]) => c);
}

function bucketTailwindClasses(classes: string[]): ComputedStyleSnapshot['tailwindClassesByCategory'] {
  const colors: string[] = [];
  const spacing: string[] = [];
  const typography: string[] = [];
  const radius: string[] = [];
  const shadow: string[] = [];

  for (const c of classes) {
    if (TAILWIND_PREFIXES.colors.test(c)) colors.push(c);
    else if (TAILWIND_PREFIXES.spacing.test(c)) spacing.push(c);
    else if (TAILWIND_PREFIXES.typography.test(c)) typography.push(c);
    else if (TAILWIND_PREFIXES.radius.test(c)) radius.push(c);
    else if (TAILWIND_PREFIXES.shadow.test(c)) shadow.push(c);
  }

  return {
    colors: colors.slice(0, 12),
    spacing: spacing.slice(0, 12),
    typography: typography.slice(0, 12),
    radius: radius.slice(0, 8),
    shadow: shadow.slice(0, 8),
  };
}
