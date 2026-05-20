/**
 * Color math for WCAG contrast checks and palette analysis.
 *
 * Implements WCAG 2.1 relative luminance and contrast ratio.
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * Pure functions, no I/O — safe to run on every token pair.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX6_RE = /^#?([0-9a-fA-F]{6})$/;
const HEX3_RE = /^#?([0-9a-fA-F]{3})$/;

export function parseHex(input: string): RGB | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const m6 = trimmed.match(HEX6_RE);
  if (m6) {
    const hex = m6[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const m3 = trimmed.match(HEX3_RE);
  if (m3) {
    const hex = m3[1];
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  return null;
}

export function toHex(rgb: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** Returns the WCAG contrast ratio between two hex colors, or null if invalid. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return null;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

/**
 * Classify a contrast ratio against WCAG 2.1 normal-text thresholds.
 * AAA: ≥ 7   AA: ≥ 4.5   AA-large (≥18pt or ≥14pt bold): ≥ 3   else fail.
 */
export function classifyContrast(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/** Count unique hex occurrences (case-insensitive, normalised to uppercase). */
export function tallyHexes(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /#[0-9a-fA-F]{6}\b/g;
  for (const m of text.matchAll(re)) {
    const k = m[0].toUpperCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
