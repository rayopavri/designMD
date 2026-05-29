/**
 * Deterministic elevation (box-shadow) scale inference.
 *
 * Shadows are effectively unobservable from a Firecrawl scrape: the `branding`
 * profile carries no shadow tokens, external-stylesheet box-shadows are not
 * inlined in the returned HTML (so the computed-style parser can't see them),
 * and a screenshot can't yield precise offset/blur/spread/alpha values. In
 * practice elevation is therefore always *inferred* from the brand's visual
 * weight rather than observed.
 *
 * This module centralises that inference so the live pipeline (Gemini
 * normalisation in `gemini.ts`) and the backfill script
 * (`scripts/backfill-elevation.ts`) produce byte-identical scales. The values
 * mirror the canonical scales documented in the Gemini extraction prompt.
 */
import type { ExtractedElevation } from '@/lib/ai/gemini';

export type ElevationWeight = 'flat' | 'standard' | 'bold';

const SCALES: Record<ElevationWeight, ReadonlyArray<{ name: string; value: string }>> = {
  flat: [
    { name: 'sm', value: '0 1px 2px rgba(0,0,0,0.06)' },
    { name: 'md', value: '0 2px 4px rgba(0,0,0,0.08)' },
    { name: 'lg', value: '0 4px 8px rgba(0,0,0,0.10)' },
    { name: 'xl', value: '0 8px 16px rgba(0,0,0,0.12)' },
  ],
  standard: [
    { name: 'sm', value: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' },
    { name: 'md', value: '0 4px 6px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)' },
    { name: 'lg', value: '0 10px 15px rgba(0,0,0,0.12), 0 4px 6px rgba(0,0,0,0.08)' },
    { name: 'xl', value: '0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.08)' },
  ],
  bold: [
    { name: 'sm', value: '0 2px 4px rgba(0,0,0,0.30)' },
    { name: 'md', value: '0 6px 12px rgba(0,0,0,0.35)' },
    { name: 'lg', value: '0 12px 24px rgba(0,0,0,0.40)' },
    { name: 'xl', value: '0 20px 40px rgba(0,0,0,0.45)' },
  ],
};

/** Pick the shadow weight that best matches the brand's declared design styles. */
export function elevationWeightFor(designStyles: readonly string[]): ElevationWeight {
  const styles = designStyles.map((s) => s.trim().toLowerCase());
  if (styles.includes('bold') || styles.includes('dark-mode')) return 'bold';
  if (styles.includes('minimal')) return 'flat';
  return 'standard';
}

/**
 * Build an inferred sm/md/lg/xl box-shadow scale for a brand. Every token is
 * marked `confidence: 'inferred'` — these are synthesized from the brand's
 * visual weight, not observed in CSS.
 */
export function inferElevationScale(designStyles: readonly string[]): ExtractedElevation[] {
  return SCALES[elevationWeightFor(designStyles)].map((t) => ({
    name: t.name,
    value: t.value,
    confidence: 'inferred',
  }));
}

/**
 * Default prose for the `## Elevation & Depth` section when extraction produced
 * none. States plainly that the scale is inferred so downstream readers (and a
 * codegen agent consuming the spec) treat it as a value to sanity-check.
 */
export function inferredElevationNote(weight: ElevationWeight): string {
  const opener: Record<ElevationWeight, string> = {
    flat: 'Subtle single-layer shadows convey minimal depth',
    standard: 'A layered shadow scale conveys depth across surfaces',
    bold: 'Heavy, high-contrast shadows convey pronounced depth',
  };
  return (
    `${opener[weight]}: \`elevation.sm\` for card lift, \`elevation.md\` for ` +
    'dropdowns and popovers, `elevation.lg` for modals and drawers, and ' +
    '`elevation.xl` for full-screen overlays. These values are inferred from the ' +
    "brand's visual weight rather than observed in CSS — verify them against the " +
    'live product before shipping.'
  );
}
