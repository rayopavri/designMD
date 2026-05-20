/**
 * Gemini 2.5 Flash extraction — canonical design.md spec aligned.
 *
 * Produces structured tokens whose shape closely mirrors the official
 * @google/design.md schema, plus prose for each canonical section
 * (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes,
 * Components, Do's and Don'ts).
 *
 * Sonnet later turns this JSON into a canonical DESIGN.md file (YAML
 * front-matter + markdown body).
 *
 * Inputs (multi-modal):
 *   - scraped markdown
 *   - rendered screenshot (image via inlineData)
 *   - computed-style snapshot (CSS vars, dominant hexes, tailwind classes)
 */
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
  type Part,
} from '@google/generative-ai';
import { env } from '@/lib/env';
import type { ComputedStyleSnapshot } from '@/lib/generator/extract-computed-styles';

let _client: GoogleGenerativeAI | null = null;

function client(): GoogleGenerativeAI {
  if (_client) return _client;
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  _client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return _client;
}

const MODEL = 'gemini-2.5-flash';

// ─── Output schema (Gemini → JSON) ──────────────────────────

export interface ExtractedColor {
  /** Token name (kebab-case). Use canonical roles when applicable:
   *  primary, secondary, tertiary, neutral, surface, on-surface, outline, error, etc. */
  name: string;
  /** Uppercase 6-char hex. */
  hex: string;
  /** Where this color is used and why. Becomes prose bullet in Colors section. */
  rationale: string;
}

export interface ExtractedTypography {
  /** Level name: display-lg, headline-md, body-lg, label-sm, etc. */
  name: string;
  fontFamily: string;
  /** Dimension string (e.g. "16px", "1.5rem"). */
  fontSize: string;
  fontWeight?: number;
  /** Dimension OR unitless multiplier (e.g. "1.5", "24px"). */
  lineHeight?: string;
  letterSpacing?: string;
  /** Plain-language role for this level. */
  rationale: string;
}

export interface ExtractedComponent {
  /** Token name (kebab-case): button-primary, card, input-field, etc. */
  name: string;
  backgroundColor?: string; // raw value OR token ref like "{colors.primary}"
  textColor?: string;
  typography?: string;
  rounded?: string;
  padding?: string;
  size?: string;
  height?: string;
  width?: string;
}

export interface ExtractedScale {
  name: string;
  value: string;
}

export interface ExtractedBrand {
  /** Brand name as it appears on the site. */
  name: string;
  /** Optional one-line tagline. */
  tagline: string | null;
  /** Short paragraph describing the product. Used for bundle.description (NOT design.md). */
  shortDescription: string;
  /** Two-or-three-sentence brand & style overview. Becomes the ## Overview section. */
  overview: string;
  /** Two or three adjectives describing the brand voice. */
  brandTone: string;
  /** Colors as an ordered list of role-bound tokens. */
  colors: ExtractedColor[];
  /** Typography levels (display, headline, body, label, etc.). */
  typography: ExtractedTypography[];
  /** Border-radius scale tokens (rounded.sm, rounded.md, ...). */
  rounded: ExtractedScale[];
  /** Spacing scale tokens. */
  spacing: ExtractedScale[];
  /** Components mapped to composite property blocks. */
  components: ExtractedComponent[];
  /** Prose for the ## Layout section. */
  layoutNotes: string;
  /** Prose for the ## Elevation & Depth section. */
  elevationNotes: string;
  /** Prose for the ## Shapes section. */
  shapesNotes: string;
  /** Prose for the ## Do's and Don'ts section — split into lists. */
  dos: string[];
  donts: string[];
  /** Design style tags from a fixed enum (dark-mode, minimal, bold, playful, enterprise, accessible). */
  designStyles: string[];
  /** DB category slug if confident. */
  category: string | null;
}

const colorItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    hex: { type: SchemaType.STRING },
    rationale: { type: SchemaType.STRING },
  },
  required: ['name', 'hex', 'rationale'],
};

const typographyItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    fontFamily: { type: SchemaType.STRING },
    fontSize: { type: SchemaType.STRING },
    fontWeight: { type: SchemaType.NUMBER, nullable: true },
    lineHeight: { type: SchemaType.STRING, nullable: true },
    letterSpacing: { type: SchemaType.STRING, nullable: true },
    rationale: { type: SchemaType.STRING },
  },
  required: ['name', 'fontFamily', 'fontSize', 'rationale'],
};

const scaleItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    value: { type: SchemaType.STRING },
  },
  required: ['name', 'value'],
};

const componentItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    backgroundColor: { type: SchemaType.STRING, nullable: true },
    textColor: { type: SchemaType.STRING, nullable: true },
    typography: { type: SchemaType.STRING, nullable: true },
    rounded: { type: SchemaType.STRING, nullable: true },
    padding: { type: SchemaType.STRING, nullable: true },
    size: { type: SchemaType.STRING, nullable: true },
    height: { type: SchemaType.STRING, nullable: true },
    width: { type: SchemaType.STRING, nullable: true },
  },
  required: ['name'],
};

const EXTRACTION_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    tagline: { type: SchemaType.STRING, nullable: true },
    shortDescription: { type: SchemaType.STRING },
    overview: { type: SchemaType.STRING },
    brandTone: { type: SchemaType.STRING },
    colors: { type: SchemaType.ARRAY, items: colorItemSchema },
    typography: { type: SchemaType.ARRAY, items: typographyItemSchema },
    rounded: { type: SchemaType.ARRAY, items: scaleItemSchema },
    spacing: { type: SchemaType.ARRAY, items: scaleItemSchema },
    components: { type: SchemaType.ARRAY, items: componentItemSchema },
    layoutNotes: { type: SchemaType.STRING },
    elevationNotes: { type: SchemaType.STRING },
    shapesNotes: { type: SchemaType.STRING },
    dos: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    donts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    designStyles: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    category: { type: SchemaType.STRING, nullable: true },
  },
  required: [
    'name',
    'shortDescription',
    'overview',
    'brandTone',
    'colors',
    'typography',
    'rounded',
    'spacing',
    'components',
    'layoutNotes',
    'elevationNotes',
    'shapesNotes',
    'dos',
    'donts',
    'designStyles',
  ],
};

// ─── System prompt ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are a design system researcher. Given a brand's website (rendered
markdown + screenshot + computed CSS), extract the brand's visual identity into the provided
schema.

The output will be used to generate a canonical Google DESIGN.md file. The DESIGN.md format
combines YAML front-matter tokens (machine-readable) with markdown prose (human-readable
rationale). Your job is to provide BOTH: the structured tokens AND the prose for each
canonical section.

CANONICAL TOKEN CONVENTIONS — follow these exactly:

Colors:
- Use role-based naming (kebab-case): primary, secondary, tertiary, neutral, surface,
  on-surface, on-primary, outline, error, etc.
- Hex format: "#RRGGBB" uppercase, sRGB color space.
- If the brand has surface variants, name them: surface-dim, surface-bright,
  surface-container-low, surface-container, surface-container-high.

Typography:
- Use semantic level names (kebab-case): display-lg, display-md, headline-lg, headline-md,
  headline-sm, body-lg, body-md, body-sm, label-lg, label-md, label-sm.
- fontSize must be a dimension string with unit: "48px", "1rem", "0.75rem".
- fontWeight is a number (400, 500, 600, 700) when observable.
- lineHeight may be a dimension ("24px") OR unitless multiplier ("1.5").
- letterSpacing is a dimension when present ("-0.02em", "0.05em").

Rounded:
- Token names from scale: xs, sm, md, lg, xl, 2xl, full.
- Values are dimension strings: "4px", "0.5rem", "9999px".

Spacing:
- Use a numeric scale: xs, sm, md, lg, xl OR specific roles (container-padding, gutter,
  section-margin).
- Values are dimension strings ("8px", "1rem") or unitless numbers (rarely).

Components:
- Component names are kebab-case: button-primary, button-primary-hover, card,
  input-field, etc.
- Variants (hover, active, pressed, disabled) get separate entries:
  button-primary AND button-primary-hover.
- Values reference defined tokens via curly braces: "{colors.primary}", "{typography.label-sm}".
- Component sub-properties: backgroundColor, textColor, typography, rounded, padding,
  size, height, width.

Prose sections — be terse, factual, designer-focused. No marketing copy.
- overview: 2-3 sentences on visual vibe, brand tone, emotional response.
- layoutNotes: 1-2 short paragraphs OR bullets on grid + spacing strategy.
- elevationNotes: 1-2 paragraphs on how depth is conveyed.
- shapesNotes: 1-2 paragraphs on radius philosophy and component shape.
- dos / donts: 3-6 entries each. Specific, actionable.

GENERAL RULES:
- Be conservative. Don't invent tokens. The computed-style snapshot lists ACTUAL CSS
  variables and dominant hexes — TRUST these over markdown text when they disagree.
- Design styles drawn from this enum only: dark-mode, minimal, bold, playful, enterprise,
  accessible.
- If you can't observe a section confidently (e.g. no shadows), say so in the prose
  ("This brand uses flat surfaces and conveys depth through color contrast rather than
  shadow.") — don't fabricate tokens.

COMPONENT COVERAGE — CRITICAL:
- Every color you define MUST be referenced by at least one component in the components list.
  Orphaned colors fail the canonical DESIGN.md linter.
- Cover the standard UI primitives at minimum: button-primary, button-primary-hover,
  button-secondary, card, input-field, input-field-focus, link, badge, divider.
- For semantic status colors (error/success/warning/info), include badge-error, badge-success,
  etc., or label-error / alert-error variants.
- For surface variants (surface-dim, surface-container, surface-container-high), reference
  them as backgroundColor on container components (card, card-elevated, card-flat).
- For on-X text colors (on-primary, on-surface), reference them as the textColor of the
  matching backgroundColor component.
- Outline/border colors lack a dedicated sub-token in the spec — reference them as
  backgroundColor on a divider/separator component (height: 1px).
- Aim for 10–18 components total. More is fine. Fewer than 8 risks orphan warnings.`;

// ─── Extraction call ─────────────────────────────────────────

const ALLOWED_STYLES = new Set(['dark-mode', 'minimal', 'bold', 'playful', 'enterprise', 'accessible']);

export interface GeminiExtractionInput {
  url: string;
  title: string;
  description: string;
  markdown: string;
  screenshotUrl: string | null;
  computed: ComputedStyleSnapshot;
}

export async function extractBrandFromMarkdown(
  input: GeminiExtractionInput,
): Promise<ExtractedBrand> {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA,
      temperature: 0.2,
    },
  });

  const computedBlock = JSON.stringify(
    {
      cssVariables: input.computed.cssVariables,
      dominantHexes: input.computed.dominantHexes,
      fontFamilies: input.computed.fontFamilies,
      tailwindClasses: input.computed.tailwindClassesByCategory,
      cssBytesAnalysed: input.computed.cssBytesAnalysed,
    },
    null,
    2,
  );

  const textPrompt = [
    `URL: ${input.url}`,
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Meta description: ${input.description}` : '',
    '',
    'Computed-style snapshot (CSS variables and Tailwind classes pulled from the rendered HTML — TRUST these):',
    '```json',
    computedBlock,
    '```',
    '',
    'Rendered markdown:',
    '```',
    input.markdown,
    '```',
  ]
    .filter(Boolean)
    .join('\n');

  const parts: Part[] = [{ text: textPrompt }];
  if (input.screenshotUrl) {
    try {
      const imagePart = await fetchImageAsPart(input.screenshotUrl);
      if (imagePart) parts.unshift(imagePart);
    } catch (err) {
      console.warn(
        '[gemini] failed to fetch screenshot, falling back to text-only:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
  });

  const text = result.response.text();
  let parsed: ExtractedBrand;
  try {
    parsed = JSON.parse(text) as ExtractedBrand;
  } catch (err) {
    throw new Error(
      `Gemini returned non-JSON: ${err instanceof Error ? err.message : String(err)}\nRaw: ${text.slice(0, 300)}`,
    );
  }

  return sanitize(parsed);
}

const IMAGE_SYSTEM_PROMPT = `You are a design system researcher. Given ONLY a screenshot of a brand's
interface (no source HTML, no scraped text), reverse-engineer the brand's visual identity into the
provided schema.

The output will be used to generate a canonical Google DESIGN.md file. Provide BOTH structured
tokens AND prose rationale for each canonical section.

You are working from a single image. Be especially careful to:
- Read color hex values from the image directly (sample backgrounds, surfaces, primary CTAs, body
  text). When the image is small or compressed, prefer the dominant flat colors over
  anti-aliased edges.
- Infer the type system from observable contrasts: display, headline, body, label sizes. If you
  cannot confidently distinguish a level, omit it rather than fabricate.
- Identify component patterns you can see: buttons, cards, inputs, badges, links, navigation.
  Do not invent components that are not visible in the screenshot.
- Note prohibitions and constraints implied by what is consistently absent.

Apply the same token conventions as the URL-based extractor (role-based color names, semantic
typography levels, kebab-case keys, "#RRGGBB" uppercase hex, dimension strings with units).

If the screenshot does not contain enough signal to identify a token group with confidence,
return an empty array for that group rather than guessing.`;

export interface ImageExtractionInput {
  brandName: string;
  imageBase64: string;
  imageMimeType: string;
}

/**
 * Image-only Gemini extraction. Used by the upload-source pipeline where
 * we have a screenshot but no scraped HTML / computed CSS / markdown.
 */
export async function extractBrandFromImage(
  input: ImageExtractionInput,
): Promise<ExtractedBrand> {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: IMAGE_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA,
      temperature: 0.2,
    },
  });

  const textPrompt = [
    `Brand: ${input.brandName}`,
    '',
    'Extract the design system you can see in this screenshot. Only return tokens you can',
    'observe directly. Empty arrays are better than guesses.',
  ].join('\n');

  const parts: Part[] = [
    { inlineData: { mimeType: input.imageMimeType, data: input.imageBase64 } },
    { text: textPrompt },
  ];

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
  });

  const text = result.response.text();
  let parsed: ExtractedBrand;
  try {
    parsed = JSON.parse(text) as ExtractedBrand;
  } catch (err) {
    throw new Error(
      `Gemini returned non-JSON: ${err instanceof Error ? err.message : String(err)}\nRaw: ${text.slice(0, 300)}`,
    );
  }

  // Backfill the brand name so downstream slugging and titling have it.
  if (!parsed.name) parsed.name = input.brandName;
  return sanitize(parsed);
}

async function fetchImageAsPart(url: string): Promise<Part | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return null;
  return { inlineData: { mimeType, data: buf.toString('base64') } };
}

function sanitize(parsed: ExtractedBrand): ExtractedBrand {
  // Colors: validate hex, uppercase, dedupe by name.
  const seen = new Set<string>();
  parsed.colors = (parsed.colors ?? [])
    .filter((c) => c && /^#[0-9a-fA-F]{6}$/.test(c.hex) && c.name && !seen.has(c.name))
    .map((c) => {
      seen.add(c.name);
      return { ...c, name: kebab(c.name), hex: c.hex.toUpperCase() };
    })
    .slice(0, 32);
  // Typography names kebab.
  parsed.typography = (parsed.typography ?? [])
    .filter((t) => t && t.name && t.fontFamily && t.fontSize)
    .map((t) => ({ ...t, name: kebab(t.name) }))
    .slice(0, 16);
  // Scales.
  parsed.rounded = (parsed.rounded ?? []).filter((s) => s.name && s.value).slice(0, 8);
  parsed.spacing = (parsed.spacing ?? []).filter((s) => s.name && s.value).slice(0, 12);
  // Components.
  parsed.components = (parsed.components ?? []).filter((c) => c.name).slice(0, 24);
  // Lists.
  parsed.dos = (parsed.dos ?? []).slice(0, 10);
  parsed.donts = (parsed.donts ?? []).slice(0, 10);
  // Design styles enum.
  parsed.designStyles = (parsed.designStyles ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ALLOWED_STYLES.has(s));
  return parsed;
}

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
