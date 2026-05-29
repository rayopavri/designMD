/**
 * Coverage scoring — sourced from the official @google/design.md linter
 * model rather than regex against the rendered file.
 *
 * Each of the seven canonical sections gets a 0-100 score based on how
 * many tokens/components/dos-donts the model resolved. Overall is then
 * gated on linter pass/fail and section presence.
 */
import { load as yamlLoad } from 'js-yaml';
import type { LintSummary } from './lint-design-md';

export interface CoverageBreakdown {
  colors: number;
  typography: number;
  layout: number;
  elevation: number;
  shapes: number;
  components: number;
  dosDonts: number;
  overall: number;
  wcagPass: boolean;
  /** % of canonical sections present (out of 8). */
  sectionCoverage: number;
}

const CANONICAL_SECTIONS = [
  ['Overview', 'Brand & Style'],
  ['Colors'],
  ['Typography'],
  ['Layout', 'Layout & Spacing'],
  ['Elevation & Depth', 'Elevation'],
  ['Shapes'],
  ['Components'],
  ["Do's and Don'ts", 'Dos and Donts', "Do's & Don'ts"],
];

export function scoreFromLint(lintSummary: LintSummary, rawMd: string): CoverageBreakdown {
  const { report } = lintSummary;
  const sections = (report.sections ?? []).map((s) => s.toLowerCase());

  const has = (aliases: string[]): boolean =>
    aliases.some((a) => sections.some((s) => s === a.toLowerCase() || s.includes(a.toLowerCase())));

  const sectionsPresent = CANONICAL_SECTIONS.filter((aliases) => has(aliases)).length;
  const sectionCoverage = Math.round((sectionsPresent / CANONICAL_SECTIONS.length) * 100);

  // Colors: count resolved color tokens (max out at 12).
  const colorCount = report.designSystem.colors.size;
  const colors = clamp(20 + Math.min(colorCount, 12) * 6.67 + (has(['Colors']) ? 0 : -20));

  // Typography: count typography levels (max out at 8).
  const typoCount = report.designSystem.typography.size;
  const typography = clamp(20 + Math.min(typoCount, 8) * 10 + (has(['Typography']) ? 0 : -20));

  // Layout / spacing: count spacing tokens.
  const spacingCount = report.designSystem.spacing.size;
  const layout = clamp(20 + Math.min(spacingCount, 8) * 10 + (has(['Layout', 'Layout & Spacing']) ? 0 : -20));

  // Elevation: the prose lives in the spec body, but the canonical token scale
  // lives in the YAML front-matter (`elevation:` map). Score on whichever signal
  // is stronger — token count (mirrors colors/typography/shapes) or prose length.
  // A present shadow scale with thin prose should NOT read as "missing": shadows
  // are effectively unobservable from a scrape, so the scale is usually inferred,
  // but a complete inferred scale is still real, usable coverage.
  const elevationCount = countFrontMatterMapKeys(rawMd, 'elevation');
  const hasElevation = has(['Elevation & Depth', 'Elevation']) || elevationCount > 0;
  const elevationTokenScore = clamp(
    20 + Math.min(elevationCount, 6) * 13 + (hasElevation ? 0 : -20),
  );
  const elevation = Math.max(
    elevationTokenScore,
    scoreProseSection(rawMd, ['Elevation & Depth', 'Elevation']),
  );

  // Shapes: count rounded tokens.
  const roundedCount = report.designSystem.rounded.size;
  const shapes = clamp(20 + Math.min(roundedCount, 6) * 13 + (has(['Shapes']) ? 0 : -20));

  // Components: count component definitions (max out at 12).
  const cmpCount = report.designSystem.components.size;
  const components = clamp(20 + Math.min(cmpCount, 12) * 6.67 + (has(['Components']) ? 0 : -20));

  // Do's and Don'ts: prose section, score on presence + row count of tables.
  const dosDonts = scoreDosDonts(rawMd);

  const sectionAvg =
    (colors + typography + layout + elevation + shapes + components + dosDonts) / 7;

  // WCAG failures are a property of the SOURCE brand, not our extraction.
  // We surface them to users as an accessibility advisory but don't
  // penalize the bundle's coverage score — our job is faithful extraction,
  // not fixing other people's contrast ratios.
  const wcagPass = lintSummary.contrastFailures.length === 0;
  const sectionFactor = 0.6 + (sectionCoverage / 100) * 0.4; // 0.6..1.0

  const overall = clamp(Math.round(sectionAvg * sectionFactor));

  return {
    colors,
    typography,
    layout,
    elevation,
    shapes,
    components,
    dosDonts,
    overall,
    wcagPass,
    sectionCoverage,
  };
}

function scoreProseSection(md: string, aliases: string[]): number {
  for (const alias of aliases) {
    const re = new RegExp(`^##\\s+${escapeRegex(alias)}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'mi');
    const m = md.match(re);
    if (m) {
      const proseLen = m[1].trim().length;
      // 100 chars = 60; 400+ chars = 100.
      return clamp(40 + Math.min(proseLen / 4, 60));
    }
  }
  return 20;
}

function scoreDosDonts(md: string): number {
  const re = /^##\s+(?:Do['’]s and Don['’]ts|Dos and Donts|Do['’]s & Don['’]ts)[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/mi;
  const m = md.match(re);
  if (!m) return 20;
  // Count table rows or bullet points.
  const rows = (m[1].match(/^\|[^\n]+\|/gm) ?? []).length;
  const bullets = (m[1].match(/^\s*[-*]\s+/gm) ?? []).length;
  const items = Math.max(rows - 1, bullets); // -1 for the header row
  return clamp(40 + items * 8);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count the entries in a DESIGN.md YAML front-matter map key (e.g. "elevation").
 * Returns 0 for the old markdown format, missing keys, or malformed front-matter
 * — callers fall back to prose scoring in those cases.
 */
function countFrontMatterMapKeys(rawMd: string, key: string): number {
  const fm = rawMd.match(/^---\n([\s\S]*?)\n---/m);
  if (!fm) return 0;
  try {
    const obj = yamlLoad(fm[1]) as Record<string, unknown> | null;
    const map = obj?.[key];
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      return Object.keys(map as Record<string, unknown>).length;
    }
  } catch {
    // Malformed front-matter — treat as no tokens.
  }
  return 0;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
