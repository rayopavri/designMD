/**
 * Deterministic orphan-color resolver.
 *
 * After Gemini extracts colors + components, scan for colors not referenced
 * by any component. For each orphan, synthesize a sensible component
 * definition so the canonical linter doesn't flag it.
 *
 * Heuristics (all conservative):
 *   - `primary`            → button-primary (bg=primary, text=on-primary)
 *   - `secondary`          → button-secondary
 *   - `tertiary`           → button-tertiary
 *   - `on-X`               → paired into the X-using component as textColor
 *   - `error|danger`       → badge-error (bg=error, text=on-error || white)
 *   - `success|positive`   → badge-success
 *   - `warning`            → badge-warning
 *   - `info`               → badge-info
 *   - `surface-*`          → card-<suffix> with backgroundColor=surface-*
 *   - `outline|border`     → divider (backgroundColor=color, height=1px)
 *
 * Only adds components if no existing component already references the color.
 */
import type {
  ExtractedBrand,
  ExtractedColor,
  ExtractedComponent,
} from '@/lib/ai/gemini';

const SEMANTIC_PAIRS = [
  { color: 'error', component: 'badge-error', onPair: 'on-error' },
  { color: 'danger', component: 'badge-danger', onPair: 'on-danger' },
  { color: 'success', component: 'badge-success', onPair: 'on-success' },
  { color: 'positive', component: 'badge-positive', onPair: 'on-positive' },
  { color: 'warning', component: 'badge-warning', onPair: 'on-warning' },
  { color: 'info', component: 'badge-info', onPair: 'on-info' },
];

const ON_PREFIX_RE = /^on-/;
const SURFACE_PREFIX_RE = /^surface(-|$)/;
const OUTLINE_RE = /^(outline|border|divider)/;
const TERTIARY_NAMES = new Set(['tertiary', 'secondary', 'accent', 'accent-2', 'accent-3']);

export function resolveOrphans(brand: ExtractedBrand): ExtractedBrand {
  const colors = brand.colors;
  if (colors.length === 0) return brand;

  const colorNames = new Set(colors.map((c) => c.name));
  const components = [...brand.components];
  const referenced = collectReferencedColors(components);

  // Pass 1: handle `on-X` colors by linking into existing X-using components.
  for (const c of colors) {
    if (referenced.has(c.name)) continue;
    const onMatch = c.name.match(/^on-(.+)$/);
    if (!onMatch) continue;
    const baseName = onMatch[1];
    if (!colorNames.has(baseName)) continue;
    // Find a component that uses this base color as backgroundColor.
    const linked = components.find(
      (cmp) =>
        cmp.backgroundColor === `{colors.${baseName}}` ||
        cmp.backgroundColor === baseName ||
        cmp.textColor === undefined && cmp.backgroundColor?.includes(baseName),
    );
    if (linked && !linked.textColor) {
      linked.textColor = `{colors.${c.name}}`;
      referenced.add(c.name);
    }
  }

  // Pass 2: synthesize semantic badge components for status colors.
  for (const { color, component, onPair } of SEMANTIC_PAIRS) {
    if (!colorNames.has(color)) continue;
    if (referenced.has(color)) continue;
    if (components.some((c) => c.name === component)) continue;
    const newComponent: ExtractedComponent = {
      name: component,
      backgroundColor: `{colors.${color}}`,
      textColor: colorNames.has(onPair) ? `{colors.${onPair}}` : undefined,
      typography: pickTypographyToken(brand, 'label-sm', 'label-md'),
      rounded: pickRoundedToken(brand, 'sm', 'md'),
      padding: '4px 8px',
    };
    components.push(newComponent);
    referenced.add(color);
    if (newComponent.textColor) referenced.add(onPair);
  }

  // Pass 3: surface variants → card-X components.
  for (const c of colors) {
    if (referenced.has(c.name)) continue;
    if (!SURFACE_PREFIX_RE.test(c.name)) continue;
    const suffix = c.name.replace(/^surface-?/, '') || 'default';
    const cmpName = `card-${suffix}`;
    if (components.some((cmp) => cmp.name === cmpName)) continue;
    const onSurfaceName = colorNames.has('on-surface') ? 'on-surface' : null;
    components.push({
      name: cmpName,
      backgroundColor: `{colors.${c.name}}`,
      textColor: onSurfaceName ? `{colors.${onSurfaceName}}` : undefined,
      rounded: pickRoundedToken(brand, 'md', 'lg'),
      padding: '16px',
    });
    referenced.add(c.name);
  }

  // Pass 4: outline/border colors → divider component.
  for (const c of colors) {
    if (referenced.has(c.name)) continue;
    if (!OUTLINE_RE.test(c.name)) continue;
    const cmpName = c.name === 'outline' ? 'divider' : `divider-${c.name}`;
    if (components.some((cmp) => cmp.name === cmpName)) continue;
    components.push({
      name: cmpName,
      backgroundColor: `{colors.${c.name}}`,
      height: '1px',
    });
    referenced.add(c.name);
  }

  // Pass 5: secondary/tertiary/accent variants → button-X if no usage yet.
  for (const c of colors) {
    if (referenced.has(c.name)) continue;
    if (!TERTIARY_NAMES.has(c.name)) continue;
    const cmpName = `button-${c.name}`;
    if (components.some((cmp) => cmp.name === cmpName)) continue;
    const onPair = colorNames.has(`on-${c.name}`) ? `on-${c.name}` : null;
    components.push({
      name: cmpName,
      backgroundColor: `{colors.${c.name}}`,
      textColor: onPair ? `{colors.${onPair}}` : undefined,
      typography: pickTypographyToken(brand, 'label-md', 'label-sm'),
      rounded: pickRoundedToken(brand, 'md', 'sm'),
      padding: '8px 16px',
    });
    referenced.add(c.name);
    if (onPair) referenced.add(onPair);
  }

  // Pass 6: any remaining orphans become a swatch component (last resort —
  // makes the linter happy without inventing fictional UI).
  for (const c of colors) {
    if (referenced.has(c.name)) continue;
    const cmpName = `swatch-${c.name}`;
    if (components.some((cmp) => cmp.name === cmpName)) continue;
    components.push({
      name: cmpName,
      backgroundColor: `{colors.${c.name}}`,
      rounded: pickRoundedToken(brand, 'sm'),
      size: '32px',
    });
    referenced.add(c.name);
  }

  return { ...brand, components };
}

// ─── Helpers ─────────────────────────────────────────────────

function collectReferencedColors(components: ExtractedComponent[]): Set<string> {
  const ref = new Set<string>();
  const re = /\{colors\.([^}]+)\}/g;
  for (const c of components) {
    for (const field of [c.backgroundColor, c.textColor]) {
      if (!field) continue;
      for (const m of field.matchAll(re)) ref.add(m[1]);
    }
  }
  return ref;
}

function pickTypographyToken(
  brand: ExtractedBrand,
  ...preferred: string[]
): string | undefined {
  const names = new Set(brand.typography.map((t) => t.name));
  for (const p of preferred) if (names.has(p)) return `{typography.${p}}`;
  return brand.typography[0] ? `{typography.${brand.typography[0].name}}` : undefined;
}

function pickRoundedToken(brand: ExtractedBrand, ...preferred: string[]): string | undefined {
  const names = new Set(brand.rounded.map((r) => r.name));
  for (const p of preferred) if (names.has(p)) return `{rounded.${p}}`;
  return brand.rounded[0] ? `{rounded.${brand.rounded[0].name}}` : undefined;
}
