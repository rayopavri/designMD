/**
 * Resolves the web fonts a parsed DESIGN.md type scale needs, so the live
 * preview can actually load them instead of falling back to the browser's
 * default serif.
 *
 * Pure + dependency-free (no React, no I/O) so it stays SSR-safe and testable.
 * Consumed by `PreviewPane.tsx`, which turns the hrefs into hoisted
 * `<link rel="stylesheet">` elements.
 */
import type { ParsedTypo } from './parse-design-md';

export interface FontSpec {
  /** Normalized family name, e.g. "IBM Plex Sans". */
  family: string;
  /** Distinct weights used, ascending and deduped. Never empty. */
  weights: number[];
}

/**
 * CSS generics and OS/system families that are NOT served by Google Fonts.
 * Compared case-insensitively against the normalized family name. Only
 * known-generic names live here; anything else is attempted (a bad family
 * fails in isolation — see `buildGoogleFontHref`).
 */
const SYSTEM_DENY_SET: ReadonlySet<string> = new Set(
  [
    // CSS generic families
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
    'math', 'emoji', 'fangsong',
    // Apple / Microsoft / common system stacks
    '-apple-system', 'blinkmacsystemfont', 'apple system',
    'segoe ui', 'segoe ui emoji', 'segoe ui symbol',
    'sf pro', 'sf pro text', 'sf pro display', 'sf mono',
    'helvetica neue', 'helvetica', 'arial', 'arial black',
    'apple color emoji', 'noto color emoji',
    'tahoma', 'verdana', 'trebuchet ms', 'times new roman', 'times',
    'courier new', 'courier', 'menlo', 'monaco', 'consolas',
    'liberation sans',
  ].map((s) => s.toLowerCase()),
);

/** Serif/slab family signals (lowercased), matched as substrings. */
const SERIF_SIGNALS = [
  'serif', // also catches "PT Serif", "Source Serif", "Noto Serif", "DM Serif"
  'slab', // "Roboto Slab", "Zilla Slab"
  'georgia', 'times', 'garamond', 'baskerville', 'cambria', 'didot',
  'playfair', 'merriweather', 'lora', 'spectral', 'cormorant', 'crimson',
  'bitter', 'vollkorn', 'frank ruhl',
];

/**
 * Normalize a CSS font-family string to a single bare family name:
 * takes the first family of a comma list, strips surrounding quotes, trims.
 * `'"IBM Plex Sans", sans-serif'` → `IBM Plex Sans`.
 */
export function normalizeFamily(fontFamily: string): string {
  const first = (fontFamily ?? '').split(',')[0] ?? '';
  return first.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function isSystemFamily(normalized: string): boolean {
  return SYSTEM_DENY_SET.has(normalized.toLowerCase());
}

/**
 * Collect unique, Google-loadable font families across every typography level,
 * each with the deduped set of weights it uses (defaults to `[400]`). Order
 * follows first appearance for determinism.
 */
export function collectFontSpecs(typography: ParsedTypo[]): FontSpec[] {
  const byFamily = new Map<string, Set<number>>();
  for (const t of typography) {
    if (!t?.fontFamily) continue;
    const family = normalizeFamily(t.fontFamily);
    if (!family || isSystemFamily(family)) continue;
    const weight = typeof t.fontWeight === 'number' && t.fontWeight > 0 ? t.fontWeight : 400;
    const weights = byFamily.get(family) ?? new Set<number>();
    weights.add(weight);
    byFamily.set(family, weights);
  }
  return [...byFamily.entries()].map(([family, weights]) => ({
    family,
    weights: [...weights].sort((a, b) => a - b),
  }));
}

/**
 * Build a Google Fonts CSS2 href for one family:
 * `{ family: "IBM Plex Sans", weights: [300,400,600] }` →
 * `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&display=swap`.
 */
export function buildGoogleFontHref(spec: FontSpec): string {
  const family = spec.family.replace(/\s+/g, '+');
  const weights = (spec.weights.length ? spec.weights : [400]).join(';');
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`;
}

/**
 * Parsed typography → distinct Google Fonts hrefs, one per family. Per-family
 * links are resilient: an unknown family 400s on its own without breaking the
 * stylesheets for the valid families.
 */
export function googleFontHrefs(typography: ParsedTypo[]): string[] {
  return collectFontSpecs(typography).map(buildGoogleFontHref);
}

/**
 * Append a generic fallback to a font-family string when it lacks one, so an
 * unavailable (e.g. proprietary/paid) font degrades to the matching generic
 * instead of the UA default serif. Strings that already include a generic are
 * returned unchanged.
 */
export function fontFamilyWithFallback(fontFamily: string): string {
  const raw = (fontFamily ?? '').trim();
  if (!raw) return 'sans-serif';

  // Already ends in / contains a generic — leave it alone.
  if (/(^|[\s,])(sans-serif|serif|monospace|system-ui|cursive|fantasy)(\s*$|,)/i.test(raw)) {
    return raw;
  }

  const normalized = normalizeFamily(raw).toLowerCase();
  const isSerif =
    (normalized.includes('serif') && !normalized.includes('sans')) ||
    SERIF_SIGNALS.some((sig) => normalized.includes(sig));

  return `${raw}, ${isSerif ? 'serif' : 'sans-serif'}`;
}
