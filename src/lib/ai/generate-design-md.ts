/**
 * Sonnet 4.6 generates a canonical Google DESIGN.md file.
 *
 * Output format:
 *   1. YAML front-matter (--- delimited): version, name, tagline, description,
 *      tone, color-scheme, colors, typography, rounded, spacing, motion, components.
 *   2. Markdown body sections in canonical order:
 *      ## Overview → ## Colors → ## Typography → ## Layout
 *      → ## Elevation & Depth → ## Shapes → ## Components → ## Do's and Don'ts
 *
 * We pre-build the YAML front-matter from the extracted brand JSON (avoids
 * Sonnet drift on YAML syntax) and ask Sonnet only to write the prose body.
 * This is more reliable than asking Sonnet to emit YAML, and keeps the token
 * authority deterministic.
 */
import { dump as yamlDump } from 'js-yaml';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, ANTHROPIC_MODELS } from './anthropic';
import type {
  ExtractedBrand,
  ExtractedColor,
  ExtractedTypography,
  ExtractedMotion,
} from './gemini';

const SYSTEM_PROMPT = `You write the markdown body of canonical Google DESIGN.md files.

The reader is an AI coding agent (Claude, Cursor, Lovable, Figma Make) that uses the
DESIGN.md to apply a brand's design language to every component it generates. The reader
already has the structured tokens in YAML front-matter; your job is to write the prose that
gives the tokens human-readable rationale and context.

You will be given:
- The structured tokens (already in YAML), so you can reference token names accurately.
- The brand's extracted overview, layout notes, elevation notes, shapes notes, dos/donts.
- Optional: voiceAndContent (CTA + heading + copy style), imageryStyle (treatment + notes),
  pagePatterns (section order, hero pattern, responsive behaviour).
- Per-token confidence flags (observed vs inferred) on colors / typography / components.
- The raw scraped markdown for grounding.

Produce ONLY the markdown body (no YAML, no --- delimiters). Use this exact section order
and headings:

## Overview

<2-3 sentences describing visual vibe, brand tone, emotional response. Plain English,
designer voice. No tokens here.>

## Colors

<1 short intro paragraph explaining the color strategy.>

<Bulleted list of the most important colors with their hex and role. Reference the YAML
token name in the prose, e.g. "Primary (#1A1C1E): Deep ink for headlines.">

<For any color whose source token has confidence: "inferred", append "(inferred)" to the
bullet's role label, e.g. "Primary (inferred) (#1A1C1E): Deep ink for headlines." Skip the
annotation when confidence is "observed" or missing — only mark the ones that are guesses.>

## Typography

<1-2 sentence intro on font choices and rationale.>

<Bulleted list of key typography levels. Reference families and roles, NOT exhaustive
sizes — the tokens have those. Apply the same "(inferred)" rule as Colors.>

## Layout

<1 paragraph or 3-5 bullets on grid + spacing strategy. Reference the spacing scale by
name when relevant ("8px base unit", "16px gutter"). When pagePatterns is provided, also
cover: the observed section order top-to-bottom (one line listing the slugs), the hero
composition pattern, and any responsive behaviour notes. Keep all of this tight — 1
paragraph total or 5-7 bullets max.>

## Elevation & Depth

<1-2 paragraphs on how depth is achieved — shadows, color contrast, borders, blur, etc.>

## Shapes

<1-2 paragraphs on radius philosophy. Reference the rounded scale.>

## Components

<For each major component listed in the YAML, 2-3 sentences on its anatomy, states, and
"use when" rule. Use ### subheadings for each component.>

## Do's and Don'ts

<A 2-column table with at least 8 data rows. Be specific — concrete, measurable rules
score better than abstract style preferences. Cover token usage, layout decisions,
typography choices, component variants, and brand voice.>

| Do | Don't |
| --- | --- |
| <specific rule> | <opposite> |
| ... | ... |

## Content Style

<Required when voiceAndContent is provided; if not provided, write a single line:
"No distinct voice patterns observed — match the brand tone described in Overview." Otherwise,
3 short paragraphs OR bullets covering:
- CTA style — how button labels read (verb form, casing, length).
- Heading tone — how headlines are phrased (benefit-led, declarative, etc.).
- Copy density — paragraph rhythm, bullet usage, whitespace.>

## Imagery & Icons

<Required when imageryStyle is provided; if not provided, write a single line:
"No distinctive imagery observed — defer to the brand's existing asset library." Otherwise,
1 short paragraph describing the treatment (photographic / illustrated / isometric /
abstract / minimal-icons / mixed) plus icon shape language, illustration style, photo
treatment, and any logo lockup constraints from the imageryStyle.notes field.>

RULES:
- No emojis. No marketing copy. No "stunning", "beautiful", "modern".
- Reference token names (e.g. \`{colors.primary}\` or "primary") rather than restating hex
  values whenever possible — the YAML is the source of truth.
- The reader is an LLM; write like you'd write to a junior dev.
- If a section has nothing to say (e.g. brand has no shadows), keep it short and explicit:
  "This brand uses flat surfaces; depth is conveyed through color contrast and borders."
- Section order is fixed: Overview → Colors → Typography → Layout → Elevation & Depth →
  Shapes → Components → Do's and Don'ts → Content Style → Imagery & Icons.
- ALL 8 canonical sections are REQUIRED: Overview, Colors, Typography, Layout,
  Elevation & Depth, Shapes, Components, Do's and Don'ts. Never omit one. If the brand
  provides no signal for a section, write a factual short paragraph explaining the absence.
- DO NOT output YAML or --- delimiters. Just the markdown body.`;

interface Input {
  brand: ExtractedBrand;
  url: string;
  scrapedMarkdown: string;
  /** Optional: derived prohibitions to weave into the Do's and Don'ts section. */
  derivedDonts?: string[];
}

const MAX_OUTPUT_TOKENS = 4096;

// Per-request timeout. Vercel kills the author-design-md function at 60s.
// 50s gives the SDK time to throw inside the worker's try/catch and let
// failJob() update the row to `failed` before the platform SIGKILLs us.
// A healthy authoring run streams in 25-35s so this is ~1.5x headroom —
// tighter than the companion timeout because the streaming output dominates.
const SONNET_TIMEOUT_MS = 50_000;

export interface GeneratedDesignMd {
  /** The full file: YAML front-matter + markdown body. */
  content: string;
  /** Just the YAML token block we constructed (for reviewer inspection). */
  yamlFrontMatter: string;
}

export async function generateDesignMd(input: Input): Promise<GeneratedDesignMd> {
  const yaml = buildYamlFrontMatter(input.brand);
  const body = await generateMarkdownBody(input, yaml);

  const content = `---\n${yaml}---\n\n${body.trim()}\n`;
  return { content, yamlFrontMatter: yaml };
}

// ─── YAML construction (deterministic, no AI) ───────────────

function buildYamlFrontMatter(brand: ExtractedBrand): string {
  const obj: Record<string, unknown> = {
    version: 'alpha',
    name: brand.name,
  };
  if (brand.tagline?.trim()) {
    obj.tagline = brand.tagline.trim();
  }
  if (brand.shortDescription?.trim()) {
    obj.description = brand.shortDescription.trim();
  }
  if (brand.brandTone?.trim()) {
    obj.tone = brand.brandTone.trim();
  }
  const isDark = brand.designStyles?.includes('dark-mode');
  if (isDark !== undefined) {
    obj['color-scheme'] = isDark ? 'dark' : 'light';
  }

  if (brand.colors.length > 0) {
    obj.colors = mapFromList(brand.colors, (c: ExtractedColor) => [c.name, c.hex]);
  }

  if (brand.typography.length > 0) {
    obj.typography = mapFromList(brand.typography, (t: ExtractedTypography) => [
      t.name,
      buildTypographyEntry(t),
    ]);
  }

  if (brand.rounded.length > 0) {
    obj.rounded = mapFromList(brand.rounded, (s) => [s.name, s.value]);
  }

  if (brand.spacing.length > 0) {
    obj.spacing = mapFromList(brand.spacing, (s) => [s.name, s.value]);
  }

  if (brand.components.length > 0) {
    const cmpMap: Record<string, Record<string, string>> = {};
    for (const c of brand.components) {
      const props: Record<string, string> = {};
      if (c.backgroundColor) props.backgroundColor = c.backgroundColor;
      if (c.textColor) props.textColor = c.textColor;
      if (c.typography) props.typography = c.typography;
      if (c.rounded) props.rounded = c.rounded;
      if (c.padding) props.padding = c.padding;
      if (c.size) props.size = c.size;
      if (c.height) props.height = c.height;
      if (c.width) props.width = c.width;
      if (c.borderColor) props.borderColor = c.borderColor;
      if (c.outlineOffset) props.outlineOffset = c.outlineOffset;
      if (Object.keys(props).length > 0) cmpMap[c.name] = props;
    }
    if (Object.keys(cmpMap).length > 0) obj.components = cmpMap;
  }

  if (brand.motion && brand.motion.length > 0) {
    obj.motion = mapFromList(brand.motion, (m: ExtractedMotion) => [m.name, m.value]);
  }

  // YAML dump with consistent quoting (hex strings need quotes per spec).
  return yamlDump(obj, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

function mapFromList<T>(
  list: T[],
  toEntry: (item: T) => [string, unknown],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of list) {
    const [k, v] = toEntry(item);
    if (k && v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

function buildTypographyEntry(t: ExtractedTypography): Record<string, unknown> {
  const out: Record<string, unknown> = {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
  };
  if (t.fontWeight) out.fontWeight = t.fontWeight;
  if (t.lineHeight) out.lineHeight = t.lineHeight;
  if (t.letterSpacing) out.letterSpacing = t.letterSpacing;
  return out;
}

// ─── Markdown body generation (Sonnet) ──────────────────────

async function generateMarkdownBody(input: Input, yaml: string): Promise<string> {
  const { brand } = input;

  const summary = JSON.stringify(
    {
      name: brand.name,
      tagline: brand.tagline,
      overview: brand.overview,
      brandTone: brand.brandTone,
      designStyles: brand.designStyles,
      layoutNotes: brand.layoutNotes,
      elevationNotes: brand.elevationNotes,
      shapesNotes: brand.shapesNotes,
      dos: brand.dos,
      donts: [...brand.donts, ...(input.derivedDonts ?? [])],
      colorsByName: brand.colors.map((c) => ({
        name: c.name,
        hex: c.hex,
        rationale: c.rationale,
        confidence: c.confidence,
      })),
      typographyByName: brand.typography.map((t) => ({
        name: t.name,
        fontFamily: t.fontFamily,
        rationale: t.rationale,
        confidence: t.confidence,
      })),
      componentNames: brand.components.map((c) => c.name),
      voiceAndContent: brand.voiceAndContent ?? null,
      imageryStyle: brand.imageryStyle ?? null,
      pagePatterns: brand.pagePatterns ?? null,
    },
    null,
    2,
  );

  const userPrompt = [
    `URL: ${input.url}`,
    `Brand: ${brand.name}`,
    '',
    'YAML front-matter (the source of truth — your prose references these token names):',
    '```yaml',
    yaml,
    '```',
    '',
    'Extracted brand context (use this for the prose):',
    '```json',
    summary,
    '```',
    input.derivedDonts && input.derivedDonts.length > 0
      ? `\nDerived WCAG-derived donts to fold into Do's and Don'ts (paraphrase, don't drop):\n${input.derivedDonts.map((d) => `- ${d}`).join('\n')}`
      : '',
    '',
    'Source page (scraped markdown, truncated):',
    '```',
    input.scrapedMarkdown.slice(0, 15_000),
    '```',
    '',
    'Produce the markdown body only — no YAML, no --- delimiters, no preamble. Start with `## Overview`.',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await anthropic()
    .messages.stream(
      {
        model: ANTHROPIC_MODELS.sonnet,
        max_tokens: MAX_OUTPUT_TOKENS,
        // cache_control isn't typed on TextBlockParam in @anthropic-ai/sdk@0.32 but
        // is accepted at runtime — prompt caching is GA on the API.
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ] as unknown as Anthropic.TextBlockParam[],
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: SONNET_TIMEOUT_MS },
    )
    .finalMessage();

  if (res.stop_reason === 'max_tokens') {
    console.warn('[generate-design-md] Claude hit max_tokens — output may be truncated');
  }

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Sonnet returned empty markdown body');
  // Strip any accidental leading YAML or H1 the model may have emitted.
  return text.replace(/^---[\s\S]*?---\s*/m, '').replace(/^#\s+[^\n]+\n+/m, '').trim();
}
