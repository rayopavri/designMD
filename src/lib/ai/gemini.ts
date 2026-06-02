/**
 * Gemini 3.1 Flash-Lite extraction — canonical design.md spec aligned.
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
import { createHash } from 'node:crypto';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Schema,
  type Part,
} from '@google/genai';
import { env } from '@/lib/env';
import type { ComputedStyleSnapshot } from '@/lib/generator/extract-computed-styles';
import type { FirecrawlBranding, FirecrawlDesignExtract } from '@/lib/ai/firecrawl';
import {
  elevationWeightFor,
  inferElevationScale,
  inferredElevationNote,
} from '@/lib/generator/infer-elevation';

let _client: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (_client) return _client;
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  _client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return _client;
}

const MODEL = 'gemini-3.1-flash-lite';

// ─── 429 / RESOURCE_EXHAUSTED retry ──────────────────────────
//
// Gemini returns HTTP 429 (status RESOURCE_EXHAUSTED) when a per-minute (RPM)
// or per-day (RPD) quota is hit. RPM spikes are transient and clear within
// seconds, so a short bounded retry recovers the call in place. This is the
// only in-call resilience the Gemini steps have — the pipeline is
// single-provider (no cross-provider fallback), so a bare 429 would otherwise
// fail the whole job. RPD exhaustion won't clear inside our budget, so we cap
// attempts and let the error surface rather than burning the worker's time on a
// doomed retry. When the server includes a RetryInfo.retryDelay we honor it; otherwise
// we use exponential backoff with jitter. Each attempt is invoked via the
// passed factory so it gets a *fresh* AbortSignal (a reused one would already
// be aborted on retry).
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1_000;
const RATE_LIMIT_MAX_DELAY_MS = 16_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref());

function isRateLimitError(err: unknown): boolean {
  const status =
    (err as { status?: unknown })?.status ?? (err as { code?: unknown })?.code;
  if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota exceeded/i.test(msg);
}

/** Best-effort parse of the server's RetryInfo.retryDelay (e.g. "12s"), in ms. */
function serverRetryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)\s*s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

async function withGeminiRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= MAX_RATE_LIMIT_RETRIES) throw err;
      const backoff = Math.min(
        RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt,
        RATE_LIMIT_MAX_DELAY_MS,
      );
      const delayMs =
        serverRetryDelayMs(err) ?? backoff + Math.floor(Math.random() * 250);
      console.warn(
        `[gemini:${label}] 429 rate-limited (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}) — retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
}

// ─── System-instruction cache (Gemini context caching) ───────
//
// Gemini 3.1 Flash-Lite supports explicit context caching: upload a long stable prefix
// once via caches.create() and reference it on subsequent generateContent
// calls. Reads bill at ~1/4 the input-token price and skip re-tokenisation,
// so we save both latency and credits on warm bursts.
//
// In serverless this only pays off when the same Node process handles
// multiple jobs within the cache TTL (e.g. bulk-upload batch mode, dev mode,
// hot Vercel containers reused inside 5 min). One-off cold invocations
// fall through to inline systemInstruction — see fallthrough below.
//
// Minimum cacheable size for gemini-3.1-flash-lite is ~1024 tokens. Shorter
// system prompts will fail caches.create with INVALID_ARGUMENT; we swallow
// that and remember the failure for the rest of the process so we don't
// re-try on every call.

const CACHE_TTL_SECONDS = 300; // 5-min window
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1_000;
// Refresh ~30s before expiry so an in-flight request doesn't race the TTL.
const CACHE_REFRESH_MARGIN_MS = 30_000;
// Hard cap on the cache-create preflight. caches.create() carries no implicit
// timeout, so an unhealthy caching endpoint (e.g. a model that doesn't support
// context caching) hangs it indefinitely — which defeats the per-request budget
// the generateContent call enforces and rides the worker to its watchdog. On
// timeout we treat it as a cache miss and fall through to inline systemInstruction.
const CACHE_CREATE_TIMEOUT_MS = 8_000;

interface CacheEntry {
  name: string;
  /** Epoch ms at which we created the cache locally. */
  createdAtMs: number;
}

const systemCacheByKey = new Map<string, CacheEntry>();
const failedCacheKeys = new Set<string>();

function cacheKeyFor(model: string, systemInstruction: string): string {
  return createHash('sha256').update(model).update('\0').update(systemInstruction).digest('hex');
}

/**
 * Returns the resource name of a cached system instruction, creating one
 * lazily if absent or expired. Returns null when caching is not viable
 * (system prompt too short, transient API failure) so callers fall back
 * to inline systemInstruction.
 */
async function getCachedSystemInstruction(
  model: string,
  systemInstruction: string,
): Promise<string | null> {
  const key = cacheKeyFor(model, systemInstruction);
  if (failedCacheKeys.has(key)) return null;

  const existing = systemCacheByKey.get(key);
  if (existing && Date.now() - existing.createdAtMs < CACHE_TTL_MS - CACHE_REFRESH_MARGIN_MS) {
    return existing.name;
  }

  try {
    const created = await client().caches.create({
      model,
      config: {
        systemInstruction,
        ttl: `${CACHE_TTL_SECONDS}s`,
        abortSignal: AbortSignal.timeout(CACHE_CREATE_TIMEOUT_MS),
      },
    });
    if (!created.name) {
      failedCacheKeys.add(key);
      return null;
    }
    systemCacheByKey.set(key, { name: created.name, createdAtMs: Date.now() });
    return created.name;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[gemini] system-instruction cache create failed (${msg.slice(0, 200)}) — falling back to inline`);
    failedCacheKeys.add(key);
    return null;
  }
}

// ─── Output schema (Gemini → JSON) ──────────────────────────

/** Token extraction confidence. `observed` = grounded in computed CSS or Firecrawl
 *  branding; `inferred` = visual guess from screenshot only. Undefined when unknown. */
export type ExtractionConfidence = 'observed' | 'inferred';

export interface ExtractedColor {
  /** Token name (kebab-case). Use canonical roles when applicable:
   *  primary, secondary, tertiary, neutral, surface, on-surface, outline, error, etc. */
  name: string;
  /** Uppercase 6-char hex. */
  hex: string;
  /** Where this color is used and why. Becomes prose bullet in Colors section. */
  rationale: string;
  confidence?: ExtractionConfidence;
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
  confidence?: ExtractionConfidence;
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
  borderColor?: string; // focus rings, hover/active borders, card borders
  outlineOffset?: string; // focus outline offset ("2px", "4px")
  confidence?: ExtractionConfidence;
}

export interface ExtractedScale {
  name: string;
  value: string;
  confidence?: ExtractionConfidence;
}

export interface ExtractedMotion {
  /** Token name (kebab-case): duration-short, easing-standard, etc. */
  name: string;
  /** CSS value string: "150ms", "cubic-bezier(0.4,0,0.2,1)", "ease-in-out" */
  value: string;
  confidence?: ExtractionConfidence;
}

export interface ExtractedElevation {
  /** Token name (kebab-case): sm, md, lg, xl, overlay — or semantic roles (card, dialog, tooltip). */
  name: string;
  /** Full CSS box-shadow value, e.g. "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)" */
  value: string;
  confidence?: ExtractionConfidence;
}

/** Voice & content patterns observed on the page. Drives the ## Content Style section. */
export interface ExtractedVoiceAndContent {
  /** CTA wording pattern. Example: "Imperative verbs; sentence case; no exclamation." */
  ctaStyle: string;
  /** Heading tone. Example: "Concrete benefit-led; punchy; no marketing fluff." */
  headingTone: string;
  /** Copy density. Example: "Short scannable paragraphs; generous whitespace; bullet-heavy." */
  copyDensity: string;
}

/** Allowed imagery treatments. `mixed` is the catch-all when the page combines styles. */
export const IMAGERY_TREATMENTS = [
  'photographic',
  'illustrated',
  'isometric',
  'abstract',
  'minimal-icons',
  'mixed',
] as const;
export type ImageryTreatment = (typeof IMAGERY_TREATMENTS)[number];

/** Imagery & icon language observed on the page. Drives the ## Imagery & Icons section. */
export interface ExtractedImageryStyle {
  treatment: ImageryTreatment;
  /** Free-form notes on icon shape, illustration style, photo cropping, logo constraints. */
  notes: string;
}

/** Page structure patterns observable from the scrape. Drives expanded ## Layout section. */
export interface ExtractedPagePatterns {
  /** Section names in observed order, e.g. ["nav", "hero", "social-proof", "features", "pricing", "footer"]. */
  sectionOrder: string[];
  /** Hero pattern description, e.g. "Centred text with asymmetric product screenshot below." */
  heroPattern: string;
  /** Responsive notes, e.g. "Mobile-first; nav collapses to drawer below 768px." */
  responsiveNotes: string;
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
  /** Motion / animation tokens (duration, easing). Optional — omit if unobservable. */
  motion?: ExtractedMotion[];
  /** Shadow / elevation tokens. Always present — minimum sm/md/lg (inferred if not observed). */
  elevation: ExtractedElevation[];
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
  /** Brand voice & content patterns. Optional; drives ## Content Style section. */
  voiceAndContent?: ExtractedVoiceAndContent;
  /** Imagery / icon style. Optional; drives ## Imagery & Icons section. */
  imageryStyle?: ExtractedImageryStyle;
  /** Page structure patterns. Optional; expands ## Layout section. */
  pagePatterns?: ExtractedPagePatterns;
}

const confidenceFieldSchema: Schema = {
  type: Type.STRING,
  enum: ['observed', 'inferred'],
  nullable: true,
};

const colorItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    hex: { type: Type.STRING },
    rationale: { type: Type.STRING },
    confidence: confidenceFieldSchema,
  },
  required: ['name', 'hex', 'rationale'],
};

const typographyItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    fontFamily: { type: Type.STRING },
    fontSize: { type: Type.STRING },
    fontWeight: { type: Type.NUMBER, nullable: true },
    lineHeight: { type: Type.STRING, nullable: true },
    letterSpacing: { type: Type.STRING, nullable: true },
    rationale: { type: Type.STRING },
    confidence: confidenceFieldSchema,
  },
  required: ['name', 'fontFamily', 'fontSize', 'rationale'],
};

const scaleItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    value: { type: Type.STRING },
    confidence: confidenceFieldSchema,
  },
  required: ['name', 'value'],
};

const componentItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    backgroundColor: { type: Type.STRING, nullable: true },
    textColor: { type: Type.STRING, nullable: true },
    typography: { type: Type.STRING, nullable: true },
    rounded: { type: Type.STRING, nullable: true },
    padding: { type: Type.STRING, nullable: true },
    size: { type: Type.STRING, nullable: true },
    height: { type: Type.STRING, nullable: true },
    width: { type: Type.STRING, nullable: true },
    borderColor: { type: Type.STRING, nullable: true },
    outlineOffset: { type: Type.STRING, nullable: true },
    confidence: confidenceFieldSchema,
  },
  required: ['name'],
};

const motionItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    value: { type: Type.STRING },
    confidence: confidenceFieldSchema,
  },
  required: ['name', 'value'],
};

const elevationItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    value: { type: Type.STRING },
    confidence: confidenceFieldSchema,
  },
  required: ['name', 'value'],
};

const voiceAndContentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ctaStyle: { type: Type.STRING },
    headingTone: { type: Type.STRING },
    copyDensity: { type: Type.STRING },
  },
  required: ['ctaStyle', 'headingTone', 'copyDensity'],
  nullable: true,
};

const imageryStyleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    treatment: {
      type: Type.STRING,
      enum: [...IMAGERY_TREATMENTS],
    },
    notes: { type: Type.STRING },
  },
  required: ['treatment', 'notes'],
  nullable: true,
};

const pagePatternsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sectionOrder: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    heroPattern: { type: Type.STRING },
    responsiveNotes: { type: Type.STRING },
  },
  required: ['sectionOrder', 'heroPattern', 'responsiveNotes'],
  nullable: true,
};

const EXTRACTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    tagline: { type: Type.STRING, nullable: true },
    shortDescription: { type: Type.STRING },
    overview: { type: Type.STRING },
    brandTone: { type: Type.STRING },
    colors: { type: Type.ARRAY, items: colorItemSchema },
    typography: { type: Type.ARRAY, items: typographyItemSchema },
    rounded: { type: Type.ARRAY, items: scaleItemSchema },
    spacing: { type: Type.ARRAY, items: scaleItemSchema },
    components: { type: Type.ARRAY, items: componentItemSchema },
    motion: { type: Type.ARRAY, items: motionItemSchema, nullable: true },
    elevation: { type: Type.ARRAY, items: elevationItemSchema },
    layoutNotes: { type: Type.STRING },
    elevationNotes: { type: Type.STRING },
    shapesNotes: { type: Type.STRING },
    dos: { type: Type.ARRAY, items: { type: Type.STRING } },
    donts: { type: Type.ARRAY, items: { type: Type.STRING } },
    designStyles: { type: Type.ARRAY, items: { type: Type.STRING } },
    category: {
      type: Type.STRING,
      enum: [
        'productivity-saas',
        'developer-tools-ides',
        'ai-llm-platforms',
        'database-devops',
        'design-creative-tools',
        'fintech-crypto',
        'e-commerce-retail',
        'media-consumer-tech',
        'automotive',
      ],
      // No `nullable: true` — Gemini MUST pick one of the nine slugs.
    },
    voiceAndContent: voiceAndContentSchema,
    imageryStyle: imageryStyleSchema,
    pagePatterns: pagePatternsSchema,
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
    'elevation',
    'layoutNotes',
    'elevationNotes',
    'shapesNotes',
    'dos',
    'donts',
    'designStyles',
    'category',
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
  size, height, width, borderColor, outlineOffset.
- For input-field-focus and button-primary-focus, set borderColor to the focus ring color.
- For card and input-field, set borderColor to the border/stroke color.

Motion (optional — only if observable from CSS transitions or animation values):
- Token names (kebab-case): duration-short, duration-medium, duration-long,
  easing-standard, easing-decelerate, easing-accelerate.
- duration values: dimension strings ("100ms", "200ms", "300ms").
- easing values: cubic-bezier string or CSS keyword ("ease-in-out", "cubic-bezier(0.4,0,0.2,1)").
- When Firecrawl branding data provides animations.transitionDuration or animations.easing,
  use those values directly as the basis for duration-medium and easing-standard.
- When designExtract.animations provides named values, use them to fill the full scale.
- If no transitions are observable, omit motion entirely (return null or empty array).

Elevation (REQUIRED — always provide at least sm, md, lg):
- Token names (kebab-case): sm, md, lg, xl, overlay — or semantic roles (card, dialog, tooltip).
- value: full CSS box-shadow string, e.g. "0 1px 3px rgba(0,0,0,0.12)" or
  "0 4px 6px -1px rgb(0,0,0,0.1), 0 2px 4px -1px rgb(0,0,0,0.06)".
- When designExtract.shadows provides values, use them directly — they are CSS-extracted.
- Order tokens from lowest to highest elevation (sm → overlay).
- If no shadow values are directly observable, synthesize an inferred scale matching the
  brand's visual weight (see STRICT MINIMUMS below) and mark confidence "inferred".

Prose sections — be terse, factual, designer-focused. No marketing copy.
- overview: 2-3 sentences on visual vibe, brand tone, emotional response.
- layoutNotes: 1-2 short paragraphs OR bullets on grid + spacing strategy.
- elevationNotes: 1-2 paragraphs on how depth is conveyed.
- shapesNotes: 1-2 paragraphs on radius philosophy and component shape.
- dos / donts: 6-8 entries each. EVERY entry MUST reference a specific token name or
  component name you extracted (e.g. "Use {colors.primary} for all primary CTAs",
  "Never apply {typography.body-md} on {colors.surface-dim} without a divider").
  Generic rules without a token anchor ("maintain consistent spacing", "avoid mixing
  weights") are worthless — if you cannot tie a rule to a named token, omit it.

GENERAL RULES:
- Be conservative. Don't invent tokens. Trust the provided data sources in this order:
  1. Firecrawl branding data (when present) — CSS-parsed by a live browser renderer.
     Prefer its colorScheme, font families, font sizes, borderRadius, and primary colors
     over any other source. Additionally map these sub-fields directly:
     - branding.animations.transitionDuration / .easing → motion duration-medium / easing-standard
     - branding.animations (any fields) → motion tokens
     - branding.icons.style → imageryStyle.notes icon shape language (e.g. "stroke", "filled", "rounded")
     - branding.layout.grid.columns / .maxWidth → layoutNotes grid description
     - branding.layout.headerHeight / .footerHeight → layoutNotes
     - branding.tone.voice / branding.tone.emojiUsage → voiceAndContent hints
     - branding.personality.tone / .energy → brandTone adjectives and overview mood
     - branding.personality.targetAudience → overview context sentence
  2. Firecrawl designExtract (when present) — LLM-extracted CSS values.
     Use designExtract.shadows for elevation tokens, designExtract.animations for motion.
  3. Computed-style snapshot — ACTUAL CSS variables and dominant hexes from the HTML.
     Trust these over markdown text.
  4. Screenshot — visual inference. Use when the above sources lack a token.
  5. Markdown — lowest priority for design tokens; useful for naming and context only.
- EXCEPTION: if the user message contains a USER-REPORTED ISSUE, it takes precedence over
  this trust order for exactly the tokens it names — re-derive those from the screenshot
  and correct them even if the branding/CSS data suggested otherwise.

TOKEN COVERAGE — STRICT MINIMUMS. The downstream coverage scorer
grades each section on resolved token counts; falling short of these
numbers produces a "thin" or "missing" rating. Hitting these is
non-negotiable. When you can't observe a value directly, INFER it
from the available signal using the canonical scales below and mark
the entry confidence: "inferred". A clearly-marked inferred token is
always better than a missing one.

Colors — MINIMUM 10 entries. Cover these tiers:
  brand:    primary, secondary OR accent (1-3 entries)
  surface:  background, surface, surface-container, surface-bright (2-4)
  semantic: error, success, warning, info (include the ones visible —
            most brands have at least 2)
  on-X:     on-primary, on-surface, on-error pairs (2-3)
  utility:  outline, divider, focus-ring (1-2)
  If observation is sparse, derive surface variants by tinting the
  observed background ±5% (light brands → lighten container, darken
  bright; dark brands → vice-versa) and synthesize on-X text colors
  from contrast principles (white or near-white on dark backgrounds,
  near-black on light). Mark these "inferred".

Typography — MINIMUM 7 levels. Cover this canonical scale:
  display-lg (3rem), display-md (2.25rem)
  headline-lg (1.875rem), headline-md (1.5rem), headline-sm (1.25rem)
  body-md (1rem), body-sm (0.875rem)
  label-md (0.875rem), label-sm (0.75rem)
  If only one body size is observable, derive the rest from that base
  using the multipliers above (×3 for display-lg, ×2.25 for display-md,
  ×1.875 for headline-lg, etc.). Mark inferred.

Spacing — MINIMUM 6 entries named exactly: xs, sm, md, lg, xl, 2xl.
  Default scale: xs=4px, sm=8px, md=16px, lg=24px, xl=32px, 2xl=48px.
  If the brand exposes a different base unit (4px or 16px), scale all
  six accordingly. Mark inferred unless explicitly observed as a CSS
  variable or computed value.

Rounded — MINIMUM 5 entries named exactly: sm, md, lg, xl, full.
  Default scale: sm=4px, md=8px, lg=12px, xl=24px, full=9999px.
  Sharper brands (sharp corners visible) → sm=2px md=4px lg=8px.
  Pill-button or fully-rounded brands → bias all values larger.
  NEVER omit this scale entirely; downstream the Shapes section
  scores 20 (MISSING) when rounded.length === 0.

Components — MINIMUM 12 entries. Baseline always included:
  button-primary, button-primary-hover, button-secondary
  card, card-elevated
  input-field, input-field-focus
  link, link-hover
  badge
  divider
  Add semantic variants (badge-error, badge-success) and surface
  variants (card-container, card-bright) when their colors exist.

Elevation — MINIMUM 3 entries (sm, md, lg). This section is REQUIRED — never omit it.
  If box-shadow values are observable in CSS variables, the computed-style snapshot, or
  designExtract.shadows, use those values directly and mark confidence "observed".
  If no shadow values are observable, synthesize a typical scale for the brand's style
  and mark all entries confidence "inferred":
    - Flat/minimal brands:  sm="0 1px 2px rgba(0,0,0,0.06)", md="0 2px 4px rgba(0,0,0,0.08)", lg="0 4px 8px rgba(0,0,0,0.10)"
    - Standard brands:      sm="0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)", md="0 4px 6px rgba(0,0,0,0.10)", lg="0 10px 15px rgba(0,0,0,0.12)"
    - Bold/dark brands:     sm="0 2px 4px rgba(0,0,0,0.30)", md="0 6px 12px rgba(0,0,0,0.35)", lg="0 12px 24px rgba(0,0,0,0.40)"
  State in elevationNotes whether the values are observed or inferred.

Motion — optional. If CSS transitions are observable, include 3+
  entries: duration-short, duration-medium, easing-standard.

TOKEN CONFIDENCE — mark each color, typography level, scale entry, component, and motion
token with a "confidence" field:
- "observed" — the token's value is grounded in Firecrawl branding data OR the computed-style
  snapshot (CSS variables, dominant hexes, font-family declarations). Use this when you can
  point to a specific CSS value backing the token.
- "inferred" — the value is a visual guess from the screenshot or a reasonable approximation
  drawn from context. Use this honestly — downstream agents will treat inferred tokens as
  ones to sanity-check before shipping.
- Omit the field entirely if you genuinely cannot tell (rare — pick one).

VOICE & CONTENT — fill the voiceAndContent object when the page text exposes a clear pattern:
- ctaStyle: how the brand writes button labels and call-to-actions. Example: "Imperative
  verbs, sentence case, no exclamation. Often 2–3 words. ('Get started', 'Talk to sales')."
- headingTone: how headlines are phrased. Example: "Concrete benefit statements, no marketing
  superlatives. Mix of declaratives and product-named features."
- copyDensity: paragraph length and rhythm. Example: "Short scannable paragraphs (1–3
  sentences). Heavy use of bullet lists and inline product names."
Omit the field entirely if the page is too sparse to characterise voice.

IMAGERY & ICONS — fill the imageryStyle object when imagery is visible in the screenshot:
- treatment: pick ONE of {photographic, illustrated, isometric, abstract, minimal-icons,
  mixed}. Use "mixed" for pages that combine more than one treatment.
- notes: free-form description — icon shape language (stroke vs filled, rounded vs sharp),
  illustration style (flat / 3D / hand-drawn), photo cropping conventions, logo lockup rules
  when observable.
Omit the field entirely if the screenshot lacks meaningful imagery.

PAGE PATTERNS — fill the pagePatterns object when the scraped structure is observable:
- sectionOrder: array of section names in the order they appear from top to bottom. Use
  short kebab-case slugs ("nav", "hero", "social-proof", "features", "use-cases",
  "pricing", "faq", "footer"). 4–8 entries typical.
- heroPattern: one sentence describing the hero composition. Example: "Centred headline
  and subhead with a single primary CTA; asymmetric product screenshot offset to the right."
- responsiveNotes: one sentence on responsive behaviour you can infer from the markup
  (media queries in computed styles, mobile-toggle nav, viewport meta). Example: "Mobile-
  first; nav collapses to a hamburger drawer below 768px."
Omit the field entirely if the page is single-section or you cannot observe structure.
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
- Aim for 12-18 components total. More is fine. Fewer than 12 produces
  THIN coverage downstream.

CATEGORY — MANDATORY. Output the slug (kebab-case), never the display name. Pick the
single best fit from this taxonomy:
- productivity-saas         — productivity apps, SaaS tools, work software (Notion, Linear, Asana)
- developer-tools-ides      — dev tools, IDEs, CI/CD, devops platforms, hosting (Vercel, GitHub, Figma plugins)
- ai-llm-platforms          — AI / ML / LLM products, agent platforms, model playgrounds (Anthropic, OpenAI, Hugging Face)
- database-devops           — databases, observability, infrastructure, monitoring (Datadog, Supabase, Neon)
- design-creative-tools     — design software, creative suites, illustration, video (Figma, Adobe, Procreate)
- fintech-crypto            — banking, payments, investing, crypto, accounting (Stripe, Wise, Ramp, Coinbase)
- e-commerce-retail         — online stores, marketplaces, retail brands (Shopify, Amazon, DTC brands)
- media-consumer-tech       — consumer apps, news, social, browsers, entertainment (Arc, Spotify, NYT)
- automotive                — car brands, racing, mobility, EV (Tesla, F1 driver sites, Rivian)

When a site straddles two, pick the dominant lens of who pays / who uses it.`;

// ─── Extraction call ─────────────────────────────────────────

const ALLOWED_STYLES = new Set(['dark-mode', 'minimal', 'bold', 'playful', 'enterprise', 'accessible']);

export interface GeminiExtractionInput {
  url: string;
  title: string;
  description: string;
  markdown: string;
  screenshotUrl: string | null;
  computed: ComputedStyleSnapshot;
  /** Firecrawl CSS-parsed branding data. When present, treat as higher confidence
   *  than computed-style snapshot for colorScheme, font families, and primary colors. */
  branding?: FirecrawlBranding | null;
  /** Firecrawl LLM-extracted design tokens (when FIRECRAWL_EXTRACT_ENABLED=true).
   *  More comprehensive than branding (full scales, not just primaries) but text-only. */
  designExtract?: FirecrawlDesignExtract | null;
  /** On re-runs: per-section instructions focusing Gemini on coverage gaps from the previous run. */
  gapHints?: string;
  /** On re-runs: free-text editor feedback describing what was wrong last time (e.g. a wrong
   *  color token). Injected as a top-priority correction that overrides the trust hierarchy
   *  for exactly the tokens it names. */
  userFeedback?: string;
}

export async function extractBrandFromMarkdown(
  input: GeminiExtractionInput,
): Promise<ExtractedBrand> {
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

  const brandingBlock = input.branding
    ? JSON.stringify(input.branding, null, 2)
    : null;

  const textPrompt = [
    `URL: ${input.url}`,
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Meta description: ${input.description}` : '',
    '',
    ...(brandingBlock
      ? [
          'Firecrawl branding data (CSS-parsed from live browser render — HIGHEST CONFIDENCE):',
          '```json',
          brandingBlock,
          '```',
          '',
        ]
      : []),
    ...(input.designExtract
      ? [
          'Firecrawl LLM-extracted design tokens (high confidence — use to fill gaps in branding data):',
          '```json',
          JSON.stringify(input.designExtract, null, 2),
          '```',
          '',
        ]
      : []),
    'Computed-style snapshot (CSS variables and Tailwind classes pulled from the rendered HTML — TRUST these):',
    '```json',
    computedBlock,
    '```',
    '',
    'Rendered markdown:',
    '```',
    input.markdown.slice(0, MAX_EXTRACTION_MARKDOWN_CHARS),
    '```',
    ...(input.gapHints
      ? [
          '',
          'COVERAGE FOCUS — these sections scored below threshold in the previous run.',
          'Pay extra attention to filling gaps here:',
          input.gapHints,
        ]
      : [
          '',
          'COVERAGE FOCUS — extract thoroughly across ALL of these sections; leave none underspecified:',
          '- Colors: extract role-bound tokens (primary, secondary, neutral, surface, error, etc.) with hex values and rationale',
          '- Typography: identify display, headline, body, label scale levels with font families, sizes, and weights',
          '- Layout: describe grid system, max-width, spacing rhythm, responsive breakpoints',
          '- Shapes: extract border-radius tokens at each scale (sm, md, lg, full)',
          '- Components: identify buttons, cards, inputs, badges, navigation with full token specs',
        ]),
    ...(input.userFeedback
      ? [
          '',
          'USER-REPORTED ISSUE FROM THE PREVIOUS RUN — TOP PRIORITY TO FIX:',
          input.userFeedback,
          'Re-examine the screenshot and the computed-style snapshot carefully and correct',
          'exactly this. For color complaints, re-derive each palette token from the',
          'screenshot + CSS variables and double-check every hex matches what the live site',
          'actually renders — do not repeat the previous values uncritically.',
        ]
      : []),
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

  const cachedName = await getCachedSystemInstruction(MODEL, SYSTEM_PROMPT);
  const result = await withGeminiRetry('extract', () =>
    client().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        ...(cachedName
          ? { cachedContent: cachedName }
          : { systemInstruction: SYSTEM_PROMPT }),
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    }),
  );

  const text = result.text ?? '';
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
return an empty array for that group rather than guessing.

TOKEN CONFIDENCE — mark each color, typography, scale, component, and motion token with a
"confidence" field. Since you only have a screenshot, nearly every token will be
"inferred" — that's expected and honest. Use "observed" sparingly, only when the screenshot
contains a literal color swatch chip, a visible CSS class label, or other unambiguous
evidence. Omit confidence entirely only when you genuinely cannot judge.

VOICE & CONTENT (voiceAndContent) — fill from observable text in the screenshot when
present: ctaStyle (button label conventions), headingTone (headline phrasing), copyDensity
(paragraph rhythm). Omit if the screenshot has too little text.

IMAGERY & ICONS (imageryStyle) — fill when imagery is visible. Choose one treatment from
{photographic, illustrated, isometric, abstract, minimal-icons, mixed} and add a notes
string describing icon shape language, illustration style, photo treatment.

PAGE PATTERNS (pagePatterns) — fill when section order is observable from the screenshot
layout: sectionOrder (top-to-bottom section slugs), heroPattern (one-sentence composition
description), responsiveNotes (one sentence; mark as inferred since you can't see media
queries). Omit if the screenshot is a single section.

CATEGORY — MANDATORY. Output the slug, never the display name. Pick the single best fit:
- productivity-saas         — productivity, SaaS, work tools
- developer-tools-ides      — dev tools, IDEs, hosting, CI/CD
- ai-llm-platforms          — AI / ML / LLM products
- database-devops           — databases, observability, infra
- design-creative-tools     — design / creative software
- fintech-crypto            — banking, payments, investing, crypto
- e-commerce-retail         — online stores, marketplaces, retail
- media-consumer-tech       — consumer apps, news, social, browsers
- automotive                — cars, racing, mobility

When unclear, infer from the dominant visual cues (CTAs, product type, audience).`;

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

  const cachedName = await getCachedSystemInstruction(MODEL, IMAGE_SYSTEM_PROMPT);
  const result = await withGeminiRetry('extract-image', () =>
    client().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        ...(cachedName
          ? { cachedContent: cachedName }
          : { systemInstruction: IMAGE_SYSTEM_PROMPT }),
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    }),
  );

  const text = result.text ?? '';
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

// ─── Plain-text generation (author step uses this for DESIGN.md body) ───

export interface GeminiTextInput {
  systemPrompt: string;
  userPrompt: string;
  /** Hard timeout — aborts the underlying fetch when exceeded. */
  timeoutMs: number;
  /** Max output tokens. */
  maxOutputTokens?: number;
  /** Sampling temperature. Lower = more deterministic. */
  temperature?: number;
}

export interface GeminiTextResult {
  content: string;
  modelUsed: string;
  latencyMs: number;
}

/**
 * Plain-text Gemini generation via the direct Google API. Used by the
 * author step (generate-design-md.ts) where we want markdown out, not
 * the structured JSON the extraction calls request. Reuses the existing
 * GoogleGenAI client singleton so this shares connection pooling and
 * the same GEMINI_API_KEY billing surface as extraction.
 *
 * The author step calls this directly with no provider fallback: one hop,
 * the same GEMINI_API_KEY billing surface as extraction. Transient 429s are
 * retried here via withGeminiRetry; the author worker's 290s watchdog is the
 * backstop for a genuine hang.
 */
export async function generateTextFromGemini(input: GeminiTextInput): Promise<GeminiTextResult> {
  const startedAt = Date.now();
  const cachedName = await getCachedSystemInstruction(MODEL, input.systemPrompt);
  const result = await withGeminiRetry('author-text', () =>
    client().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
      config: {
        ...(cachedName
          ? { cachedContent: cachedName }
          : { systemInstruction: input.systemPrompt }),
        temperature: input.temperature ?? 0.4,
        maxOutputTokens: input.maxOutputTokens ?? 6144,
        // Author-step latency control. Gemini 3.x Flash-Lite thinks at a high
        // level by default when unset, which on heavy pages can run 180s+ (vs
        // the ~8-15s typical). MEDIUM caps thinking (~5s) while preserving spec
        // quality — see generate-design-md.ts callAuthorModel.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        abortSignal: AbortSignal.timeout(input.timeoutMs),
      },
    }),
  );
  const content = result.text ?? '';
  if (!content.trim()) {
    throw new Error(`Gemini direct returned empty content (model=${MODEL})`);
  }
  return {
    content,
    modelUsed: MODEL,
    latencyMs: Date.now() - startedAt,
  };
}

export interface QuickNameItem {
  url: string;
  title?: string;
  ogSiteName?: string;
  ogTitle?: string;
}

const QUICK_NAMES_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING },
      name: { type: Type.STRING },
    },
    required: ['url', 'name'],
  },
};

const QUICK_NAMES_SYSTEM_PROMPT = `You map website metadata to canonical brand names.

For each item you are given a URL and whatever page metadata could be read (HTML
<title>, og:site_name, og:title — any may be missing). Return the brand / product
name a person would call the site, NOT the full page title.

Rules:
- Strip taglines and section suffixes: "Stripe | Payments Infrastructure" -> "Stripe";
  "Linear – The issue tracker for modern teams" -> "Linear".
- Prefer og:site_name when it already looks like a clean brand name.
- Do not invent names. If metadata is too sparse to tell, echo the registrable
  domain label (e.g. "example" for example.com).
- Return exactly one entry per input URL, preserving the exact url string given.`;

/**
 * Lightweight batched brand-name extraction for bulk-upload dedup. Given raw
 * page-metadata tuples for a set of URLs, returns the canonical brand name for
 * each in ONE structured-output call.
 *
 * This is deliberately NOT the full design extraction — it exists only so the
 * bulk-upload endpoint can detect "same brand, different URL" duplicates cheaply
 * before enqueuing. Best-effort: callers fall back to metadata-derived names if
 * this throws or times out. Reuses the extraction client / model / billing surface.
 */
export async function extractBrandNamesQuick(
  items: QuickNameItem[],
  timeoutMs = 12_000,
): Promise<{ url: string; name: string }[]> {
  if (items.length === 0) return [];

  const userPrompt = [
    'Return the canonical brand name for each of these sites:',
    '```json',
    JSON.stringify(items, null, 2),
    '```',
  ].join('\n');

  const result = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: QUICK_NAMES_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: QUICK_NAMES_SCHEMA,
      temperature: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });

  const text = result.text ?? '';
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('extractBrandNamesQuick: expected a JSON array');
  }
  return parsed
    .filter(
      (r): r is { url: string; name: string } =>
        !!r && typeof r.url === 'string' && typeof r.name === 'string',
    )
    .map((r) => ({ url: r.url, name: r.name }));
}

// Full-page screenshots can be 10,000+ px tall. Gemini downscales aggressively
// past ~3MP, which turns text/components into mush and tanks extraction
// quality. Clamp dimensions before sending — we keep the original full-page
// version in Vercel Blob for the home gallery hover-scroll. The 2400px cap
// keeps total vision-token budget low (hero + 2-3 sections) so the call
// stays well under the scrape-and-extract worker's 300s budget.
const MAX_EXTRACTION_WIDTH = 1600;
const MAX_EXTRACTION_HEIGHT = 2400;
const EXTRACTION_JPEG_QUALITY = 88;

// Cap the scraped markdown injected into the Gemini prompt. Firecrawl already
// trims to 80k chars for storage, but that's ~20k tokens of text the model
// has to chew through alongside the screenshot and the structured-output
// schema. 12k chars (~3k tokens) is enough representative copy for category,
// voice, and component naming without inflating TTFT.
const MAX_EXTRACTION_MARKDOWN_CHARS = 12_000;

// Per-request timeout for the Gemini generateContent call. MUST stay tighter
// than the scrape-and-extract worker's 290s watchdog (Vercel Pro maxDuration
// 300s) so the AbortSignal fires inside the worker's try/catch and failJob()
// runs before the platform SIGKILLs us. A SIGKILL would leave the
// generation_jobs row in `running` state and trigger a QStash retry storm.
// Firecrawl already consumes ~38s of that budget; a normal extraction returns
// in 8-25s, so 180s is a generous ceiling that lets a slow-but-valid call
// finish (the goal: never cut a good generation short) while still catching a
// true hang. Passed as config.abortSignal via AbortSignal.timeout() — the
// @google/genai SDK aborts the fetch and rejects when the signal fires. Note:
// client-only; Google still processes (and bills) the in-flight request.
const GEMINI_TIMEOUT_MS = 180_000;

async function fetchImageAsPart(url: string): Promise<Part | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const original = Buffer.from(await res.arrayBuffer());
  if (original.length === 0) return null;

  try {
    const sharpMod = (await import('sharp')).default;
    const meta = await sharpMod(original).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const needsResize = width > MAX_EXTRACTION_WIDTH;
    const needsCrop = (needsResize ? Math.round((MAX_EXTRACTION_WIDTH / width) * height) : height) > MAX_EXTRACTION_HEIGHT;

    if (!needsResize && !needsCrop && width > 0 && height > 0) {
      const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
      return { inlineData: { mimeType, data: original.toString('base64') } };
    }

    let pipeline = sharpMod(original);
    if (needsResize) {
      pipeline = pipeline.resize({ width: MAX_EXTRACTION_WIDTH, withoutEnlargement: true });
    }
    if (needsCrop) {
      // Crop from the top — hero + initial sections carry the strongest
      // design signal. Stopping at MAX_EXTRACTION_HEIGHT loses footer, which
      // matters less for token extraction than legibility of the rest.
      const targetW = needsResize ? MAX_EXTRACTION_WIDTH : width;
      pipeline = pipeline.extract({ left: 0, top: 0, width: targetW, height: MAX_EXTRACTION_HEIGHT });
    }
    const out = await pipeline.jpeg({ quality: EXTRACTION_JPEG_QUALITY }).toBuffer();
    return { inlineData: { mimeType: 'image/jpeg', data: out.toString('base64') } };
  } catch (err) {
    console.warn(
      '[gemini] sharp pipeline failed, sending original:',
      err instanceof Error ? err.message : err,
    );
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    return { inlineData: { mimeType, data: original.toString('base64') } };
  }
}

const CONFIDENCE_VALUES = new Set<ExtractionConfidence>(['observed', 'inferred']);
const ALLOWED_TREATMENTS = new Set<string>(IMAGERY_TREATMENTS);

function normaliseConfidence<T extends { confidence?: ExtractionConfidence }>(item: T): T {
  if (item.confidence && !CONFIDENCE_VALUES.has(item.confidence)) {
    delete item.confidence;
  }
  return item;
}

function sanitize(parsed: ExtractedBrand): ExtractedBrand {
  // Colors: normalize hex (accept #RGB, #RRGGBB, #RRGGBBAA), uppercase,
  // dedupe by name. Previously a strict /^#[0-9a-fA-F]{6}$/ regex silently
  // dropped entries from models that occasionally returned the shorthand
  // or alpha forms — losing tokens we already paid extraction for.
  const seen = new Set<string>();
  parsed.colors = (parsed.colors ?? [])
    .map((c) => (c ? { ...c, hex: normalizeHex(c.hex) } : c))
    .filter((c): c is typeof c & { hex: string } =>
      Boolean(c && c.hex && c.name && !seen.has(c.name)),
    )
    .map((c) => {
      seen.add(c.name);
      return normaliseConfidence({ ...c, name: kebab(c.name) });
    })
    .slice(0, 32);
  // Typography names kebab.
  parsed.typography = (parsed.typography ?? [])
    .filter((t) => t && t.name && t.fontFamily && t.fontSize)
    .map((t) => normaliseConfidence({ ...t, name: kebab(t.name) }))
    .slice(0, 16);
  // Scales. Kebab the names so component refs (which we also kebab when
  // comparing in pruneInvalidComponentRefs) line up regardless of whether
  // the LLM emitted camelCase, Title_Case, etc.
  parsed.rounded = (parsed.rounded ?? [])
    .filter((s) => s.name && s.value)
    .map((s) => normaliseConfidence({ ...s, name: kebab(s.name) }))
    .slice(0, 8);
  parsed.spacing = (parsed.spacing ?? [])
    .filter((s) => s.name && s.value)
    .map((s) => normaliseConfidence({ ...s, name: kebab(s.name) }))
    .slice(0, 12);
  // Components. Kebab name AND keep ref-shaped property values untouched
  // here — the pruner normalises ref names on its own when comparing.
  parsed.components = (parsed.components ?? [])
    .filter((c) => c.name)
    .map((c) => normaliseConfidence({ ...c, name: kebab(c.name) }))
    .slice(0, 24);
  // Motion.
  if (parsed.motion) {
    parsed.motion = parsed.motion
      .filter((m) => m.name && m.value)
      .map((m) => normaliseConfidence({ ...m, name: kebab(m.name) }))
      .slice(0, 12);
    if (parsed.motion.length === 0) delete parsed.motion;
  }
  // Elevation — now required; always normalise, never delete.
  parsed.elevation = (parsed.elevation ?? [])
    .filter((e) => e.name && e.value)
    .map((e) => normaliseConfidence({ ...e, name: kebab(e.name) }))
    .slice(0, 8);
  // Shadows are effectively unobservable from a scrape (the branding profile
  // carries none, external-stylesheet box-shadows aren't inlined in the HTML,
  // and a screenshot can't yield exact values), so Gemini frequently returns no
  // elevation tokens despite the schema requiring them. Guarantee a usable scale
  // by synthesising one from the brand's visual weight — the same deterministic
  // inference the backfill script uses — so the Elevation & Depth section is
  // never empty and never scores as "missing".
  if (parsed.elevation.length === 0) {
    parsed.elevation = inferElevationScale(parsed.designStyles ?? []);
  }
  if (!parsed.elevationNotes?.trim()) {
    parsed.elevationNotes = inferredElevationNote(elevationWeightFor(parsed.designStyles ?? []));
  }
  // Lists.
  parsed.dos = (parsed.dos ?? []).slice(0, 10);
  parsed.donts = (parsed.donts ?? []).slice(0, 10);
  // Design styles enum.
  parsed.designStyles = (parsed.designStyles ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ALLOWED_STYLES.has(s));

  // Voice & content: trim long strings, drop the block if entirely empty.
  if (parsed.voiceAndContent) {
    const v = parsed.voiceAndContent;
    const trimmed = {
      ctaStyle: (v.ctaStyle ?? '').trim().slice(0, 400),
      headingTone: (v.headingTone ?? '').trim().slice(0, 400),
      copyDensity: (v.copyDensity ?? '').trim().slice(0, 400),
    };
    if (!trimmed.ctaStyle && !trimmed.headingTone && !trimmed.copyDensity) {
      delete parsed.voiceAndContent;
    } else {
      parsed.voiceAndContent = trimmed;
    }
  }

  // Imagery style: coerce treatment to allowed enum, fall back to 'mixed'.
  if (parsed.imageryStyle) {
    const raw = (parsed.imageryStyle.treatment ?? '').toString().trim().toLowerCase();
    const treatment = (ALLOWED_TREATMENTS.has(raw) ? raw : 'mixed') as ImageryTreatment;
    const notes = (parsed.imageryStyle.notes ?? '').trim().slice(0, 600);
    if (!notes) {
      delete parsed.imageryStyle;
    } else {
      parsed.imageryStyle = { treatment, notes };
    }
  }

  // Page patterns: clip section order, trim prose, drop block if entirely empty.
  if (parsed.pagePatterns) {
    const p = parsed.pagePatterns;
    const sectionOrder = (Array.isArray(p.sectionOrder) ? p.sectionOrder : [])
      .map((s) => (typeof s === 'string' ? kebab(s) : ''))
      .filter((s) => s.length > 0)
      .slice(0, 12);
    const heroPattern = (p.heroPattern ?? '').trim().slice(0, 400);
    const responsiveNotes = (p.responsiveNotes ?? '').trim().slice(0, 400);
    if (sectionOrder.length === 0 && !heroPattern && !responsiveNotes) {
      delete parsed.pagePatterns;
    } else {
      parsed.pagePatterns = { sectionOrder, heroPattern, responsiveNotes };
    }
  }

  // Drop or rewrite component property values that reference tokens we
  // don't have defined. The downstream @google/design.md linter's
  // broken-ref rule is severity='error', and every unresolved ref blocks
  // the auto-publish gate (errors === 0). LLMs reliably hallucinate
  // token names ~5-10% of the time ({colors.brand-blue} when the colors
  // block has `primary`), so we prune deterministically in-process
  // rather than relying on the prompt to never miss.
  //
  // The orphan resolver runs next; it creates refs to colors/typography/
  // rounded names that actually exist on the brand object (after our
  // kebab normalization above), so it never adds broken refs back.
  pruneInvalidComponentRefs(parsed);

  return parsed;
}

const COMPONENT_REF_PROPS = [
  'backgroundColor',
  'textColor',
  'typography',
  'rounded',
  'padding',
  'size',
  'height',
  'width',
  'borderColor',
  'outlineOffset',
] as const satisfies readonly (keyof ExtractedComponent)[];

// Match any {namespace.name} ref appearing in a string. Global so we can
// rewrite composite values like 'padding: "{spacing.xs} {spacing.lg}"'
// instead of treating the whole value as one ref. Inner whitespace is
// tolerated ('{ colors.primary }') because models trained on CSS often
// emit it. Name capture stops at whitespace or '}' so '{a.b c.d}' parses
// as two separate (malformed) refs rather than one with ' c.d' in the
// name.
const TOKEN_REF_GLOBAL_RE = /\{\s*([a-zA-Z][a-zA-Z0-9]*)\.\s*([^\s}]+)\s*\}/g;

function pruneInvalidComponentRefs(parsed: ExtractedBrand): void {
  // All token names are already kebab-cased in sanitize. Build the valid
  // ref set from those canonical names; the matcher below kebabs the
  // LLM-emitted name on lookup so case/format drift between the two
  // doesn't cause false rejections.
  const validRefs = new Set<string>();
  for (const c of parsed.colors) validRefs.add(`colors.${c.name}`);
  for (const t of parsed.typography) validRefs.add(`typography.${t.name}`);
  for (const r of parsed.rounded) validRefs.add(`rounded.${r.name}`);
  for (const s of parsed.spacing) validRefs.add(`spacing.${s.name}`);
  for (const m of parsed.motion ?? []) validRefs.add(`motion.${m.name}`);

  let prunedCount = 0;
  for (const comp of parsed.components) {
    for (const prop of COMPONENT_REF_PROPS) {
      const val = comp[prop];
      if (typeof val !== 'string') continue;
      // Reset lastIndex defensively — TOKEN_REF_GLOBAL_RE is shared.
      TOKEN_REF_GLOBAL_RE.lastIndex = 0;
      if (!TOKEN_REF_GLOBAL_RE.test(val)) continue; // direct value (hex, dimension) — leave alone

      let anyInvalid = false;
      const rewritten = val.replace(TOKEN_REF_GLOBAL_RE, (_full, namespace: string, name: string) => {
        const kebabName = kebab(name);
        const refKey = `${namespace}.${kebabName}`;
        if (validRefs.has(refKey)) {
          // Rewrite to canonical form (no whitespace, kebab name) so the
          // YAML emitter and downstream linter see the resolved shape.
          return `{${namespace}.${kebabName}}`;
        }
        anyInvalid = true;
        // Return the original match — we'll drop the whole prop below.
        return `{${namespace}.${name}}`;
      });

      if (anyInvalid) {
        comp[prop] = undefined;
        prunedCount++;
      } else if (rewritten !== val) {
        comp[prop] = rewritten;
      }
    }
  }
  if (prunedCount > 0) {
    console.log(
      `[gemini:sanitize] pruned ${prunedCount} unresolvable component token refs`,
    );
  }
}

/**
 * Normalize a hex color to canonical "#RRGGBB" uppercase form.
 * Accepts:
 *   - "#RGB"      → "#RRGGBB" (e.g. "#fff" → "#FFFFFF")
 *   - "#RRGGBB"   → "#RRGGBB" (uppercased)
 *   - "#RRGGBBAA" → "#RRGGBB" (alpha stripped — token YAML is opaque)
 * Returns null for any other shape so caller can drop the entry.
 */
function normalizeHex(hex: unknown): string | null {
  if (typeof hex !== 'string') return null;
  const cleaned = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[1];
    const g = cleaned[2];
    const b = cleaned[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{8}$/.test(cleaned)) return cleaned.slice(0, 7).toUpperCase();
  return null;
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
