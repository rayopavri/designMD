/**
 * Parses a designMd string into structured token data for the live preview.
 *
 * Handles two formats:
 *  - New YAML format (version: alpha): full token maps in YAML front-matter.
 *  - Old markdown format (brand: X): tokens in "# TOKEN VALUES" markdown sections.
 */
import { load as yamlLoad } from 'js-yaml';

export interface ParsedColor {
  name: string;
  hex: string;
}

export interface ParsedTypo {
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight?: number;
  letterSpacing?: string;
  lineHeight?: string | number;
}

export interface ParsedScale {
  name: string;
  value: string;
}

export interface ParsedComponent {
  name: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  rounded?: string;
  padding?: string;
}

export interface ParsedTokens {
  colors: ParsedColor[];
  typography: ParsedTypo[];
  spacing: ParsedScale[];
  rounded: ParsedScale[];
  components: ParsedComponent[];
  colorScheme: 'dark' | 'light' | 'unknown';
}

const EMPTY: ParsedTokens = {
  colors: [],
  typography: [],
  spacing: [],
  rounded: [],
  components: [],
  colorScheme: 'unknown',
};

export function parseDesignMd(designMd: string): ParsedTokens {
  if (!designMd?.trim()) return EMPTY;
  try {
    return doParse(designMd);
  } catch {
    return EMPTY;
  }
}

function doParse(raw: string): ParsedTokens {
  // Extract front-matter between first two "---" lines.
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/m);
  const fmStr = fmMatch?.[1] ?? '';
  const fm = fmStr ? (yamlLoad(fmStr) as Record<string, unknown> | null) ?? {} : {};

  // ── New YAML format: has `colors:` as an object with hex string values ─────
  if (fm.colors && typeof fm.colors === 'object' && !Array.isArray(fm.colors)) {
    return parseNewFormat(fm, raw);
  }

  // ── Old markdown format: tokens live in # TOKEN VALUES sections ─────────────
  return parseOldFormat(fm, raw);
}

// ─── New YAML format ──────────────────────────────────────────────────────────

function parseNewFormat(fm: Record<string, unknown>, _raw: string): ParsedTokens {
  const colorMap: Record<string, string> = {};
  const colors: ParsedColor[] = [];
  const colorsObj = fm.colors as Record<string, unknown>;
  for (const [name, val] of Object.entries(colorsObj)) {
    if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
      colorMap[name] = val.toUpperCase();
      colors.push({ name, hex: val.toUpperCase() });
    }
  }

  const roundedMap: Record<string, string> = {};
  const rounded: ParsedScale[] = [];
  if (fm.rounded && typeof fm.rounded === 'object' && !Array.isArray(fm.rounded)) {
    for (const [name, val] of Object.entries(fm.rounded as Record<string, unknown>)) {
      const v = String(val);
      roundedMap[name] = v;
      rounded.push({ name, value: v });
    }
  }

  const typography: ParsedTypo[] = [];
  if (fm.typography && typeof fm.typography === 'object' && !Array.isArray(fm.typography)) {
    for (const [name, val] of Object.entries(fm.typography as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        const t = val as Record<string, unknown>;
        if (t.fontFamily && t.fontSize) {
          typography.push({
            name,
            fontFamily: String(t.fontFamily),
            fontSize: String(t.fontSize),
            fontWeight: typeof t.fontWeight === 'number' ? t.fontWeight : undefined,
            letterSpacing: t.letterSpacing != null ? String(t.letterSpacing) : undefined,
            lineHeight: t.lineHeight != null ? (typeof t.lineHeight === 'number' ? t.lineHeight : String(t.lineHeight)) : undefined,
          });
        }
      }
    }
  }

  const spacing: ParsedScale[] = [];
  if (fm.spacing && typeof fm.spacing === 'object' && !Array.isArray(fm.spacing)) {
    for (const [name, val] of Object.entries(fm.spacing as Record<string, unknown>)) {
      spacing.push({ name, value: String(val) });
    }
  }

  const components: ParsedComponent[] = [];
  if (fm.components && typeof fm.components === 'object' && !Array.isArray(fm.components)) {
    for (const [name, val] of Object.entries(fm.components as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        const c = val as Record<string, unknown>;
        components.push({
          name,
          backgroundColor: resolveColor(c.backgroundColor, colorMap),
          textColor: resolveColor(c.textColor, colorMap),
          borderColor: resolveColor(c.borderColor, colorMap),
          rounded: resolveRounded(c.rounded, roundedMap),
          padding: c.padding != null ? String(c.padding) : undefined,
        });
      }
    }
  }

  const colorScheme = inferColorScheme(fm, colors);

  return { colors, typography, spacing, rounded, components, colorScheme };
}

// ─── Old markdown format ──────────────────────────────────────────────────────

function parseOldFormat(_fm: Record<string, unknown>, raw: string): ParsedTokens {
  const colors: ParsedColor[] = [];
  const spacing: ParsedScale[] = [];
  const rounded: ParsedScale[] = [];

  // Parse "## Colors" section: lines like "- name: #HEX" or "- name:    #HEX"
  const colorSection = raw.match(/##\s+Colors\n([\s\S]*?)(?=\n##|\n#[^#]|$)/);
  if (colorSection) {
    for (const line of colorSection[1].split('\n')) {
      const m = line.match(/^\s*-\s+([\w_-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
      if (m) colors.push({ name: m[1], hex: m[2].toUpperCase() });
    }
  }

  // Parse "## Radius" or "## Rounded" section
  const radiusSection = raw.match(/##\s+(?:Radius|Rounded)\n([\s\S]*?)(?=\n##|\n#[^#]|$)/);
  if (radiusSection) {
    for (const line of radiusSection[1].split('\n')) {
      const m = line.match(/^\s*-\s+([\w_-]+)\s*:\s*(\S+)/);
      if (m) rounded.push({ name: m[1], value: m[2] });
    }
  }

  // Parse "## Spacing" section
  const spacingSection = raw.match(/##\s+Spacing\n([\s\S]*?)(?=\n##|\n#[^#]|$)/);
  if (spacingSection) {
    // Handle "- scale: [4, 8, 12, 16, ...]" and "- name: value"
    for (const line of spacingSection[1].split('\n')) {
      const listM = line.match(/^\s*-\s+([\w_-]+)\s*:\s*(\S+)/);
      if (listM && listM[1] !== 'scale') spacing.push({ name: listM[1], value: listM[2] });
    }
  }

  // No component anatomy parsed from old format (too freeform to parse reliably)
  const colorScheme = inferColorScheme({}, colors);

  return { colors, typography: [], spacing, rounded, components: [], colorScheme };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveColor(val: unknown, colorMap: Record<string, string>): string | undefined {
  if (!val) return undefined;
  const s = String(val);
  const m = s.match(/^\{colors\.(.+)\}$/);
  if (m) return colorMap[m[1]];
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s.toUpperCase();
  return s;
}

function resolveRounded(val: unknown, roundedMap: Record<string, string>): string | undefined {
  if (!val) return undefined;
  const s = String(val);
  const m = s.match(/^\{rounded\.(.+)\}$/);
  if (m) return roundedMap[m[1]] ?? s;
  return s;
}

function inferColorScheme(
  fm: Record<string, unknown>,
  colors: ParsedColor[],
): 'dark' | 'light' | 'unknown' {
  // Explicit field first
  if (fm['color-scheme'] === 'dark') return 'dark';
  if (fm['color-scheme'] === 'light') return 'light';

  // Infer from surface/canvas/background color luminance
  const surfaceColor = colors.find(c =>
    /^(canvas|background|surface)$/.test(c.name),
  );
  if (surfaceColor) {
    return isLuminanceDark(surfaceColor.hex) ? 'dark' : 'light';
  }
  return 'unknown';
}

/** Returns true if the hex color has relative luminance < 0.4 (perceived as dark). */
export function isLuminanceDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum < 0.4;
}

/** Extract a pixel number from a fontSize string like "16px", "1rem", "56px". */
export function parsePx(fontSize: string): number {
  const px = fontSize.match(/^([\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  const rem = fontSize.match(/^([\d.]+)rem$/);
  if (rem) return parseFloat(rem[1]) * 16;
  return 16;
}
