/**
 * Sonnet 4.6 generates the companion prompt — the system-instruction
 * that teaches an AI coding tool how to apply the design.md spec when
 * generating new components.
 *
 * Output is plain markdown. The prompt is tool-agnostic but written so
 * it slots into Claude, Cursor, Lovable, and Figma Make.
 *
 * Caching: the system prompt is large and stable across requests, so
 * we attach `cache_control: { type: 'ephemeral' }` to it. After the first
 * call in a 5-min window, subsequent calls hit the prefix cache and
 * cut TTFT/latency substantially. The volatile brand JSON stays in the
 * user message so the cache key remains stable per prompt revision.
 */
import { anthropic, ANTHROPIC_MODELS } from './anthropic';
import type { ExtractedBrand } from './gemini';
import { perf } from '@/lib/generator/perf-log';

export const SYSTEM_PROMPT = `You write companion prompts for design system specs.

A companion prompt sits next to a design.md file and tells an AI coding tool how to apply
that spec when generating UI. It is read by Claude / Cursor / Lovable / Figma Make on every
generation, so it must be terse, unambiguous, and tool-agnostic. The reader is an LLM, not
a human; write like you'd write to a junior dev who has the spec open in a side panel.

# Output structure

Produce markdown with exactly these top-level sections, in this order:

## Role
One sentence. State that the AI is an assistant generating UI for <brand>, using the
design.md spec as ground truth. Mention the brand's tone in one short clause if it carries
clear character ("playful", "enterprise", "minimal", etc.).

## How to use design.md
3–5 numbered rules describing how the AI should consult the spec on every generation. Cover:
- Always reference tokens by their YAML name (e.g. \`{colors.primary}\`, \`{typography.body-md}\`)
  rather than hardcoded values.
- Respect the component shapes defined under \`components:\` — don't invent variants the spec
  doesn't list.
- Follow the section narrative (Layout, Elevation & Depth, Shapes) when making layout or
  shape decisions.
- Treat the Do's and Don'ts table as authoritative; if it conflicts with a user's request,
  surface the conflict before silently overriding the spec.

## Output contract
Two bulleted sub-lists:

**Must:**
- Use tokens by name.
- Cover hover / focus / disabled states for any interactive component when the spec defines them.
- Use the canonical spacing scale and radius scale.
- Match the brand's voice in copy (CTAs, headings) per the Content Style section when present.

**Must NOT:**
- Invent colors, fonts, or radii that aren't in the spec.
- Use generic Tailwind defaults (e.g. \`text-gray-500\`, \`rounded-md\`) when a brand token exists.
- Add emoji, marketing copy, or filler.
- Reference frameworks (Tailwind, Figma, shadcn) — the companion is tool-agnostic.

## When in doubt
3–5 fallback rules. Examples to draw from:
- If the spec doesn't define a value, ask the user before inventing one.
- Prefer composition (combining existing components) over introducing new tokens.
- For ambiguous color roles, default to the closest semantic token (surface for backgrounds,
  on-surface for text on surface, primary for the brand's headline action).
- For unspecified breakpoints, follow the responsive notes in Layout; if absent, default to
  mobile-first with one breakpoint at 768px.

# Rules

- ≤ 350 words total across the whole companion prompt. Aim for ~250 words; 350 is the hard cap.
- Tool-agnostic — never reference Tailwind, Figma, shadcn, Radix, or any one framework.
- No emojis. No marketing copy. No filler ("you got this!", "let's build something amazing!").
- Concrete over abstract: "use \`{colors.primary}\` for the headline CTA background" beats
  "use the brand's accent color".
- Reference token names with backtick-wrapped curly-brace syntax: \`{colors.primary}\`,
  \`{typography.headline-lg}\`, \`{rounded.md}\`.
- Output only the markdown body — no preamble, no closing meta-commentary, no code fence
  around the whole output.

# Few-shot examples

Here are two short examples to anchor tone and length. Do not copy structure verbatim; adapt
to the brand at hand.

## Example A — minimal SaaS brand

# Role
You are an AI assistant generating UI for Northstar Analytics, a minimal enterprise SaaS
brand. Match its restrained, data-forward tone.

# How to use design.md
1. Reference tokens by name (\`{colors.primary}\`, \`{typography.headline-md}\`) on every
   component. Never hardcode hex values or font sizes.
2. Use the spacing scale \`{spacing.xs}\` through \`{spacing.2xl}\` for all paddings and gaps.
3. Apply \`{rounded.sm}\` to inputs and \`{rounded.md}\` to cards. Buttons follow the components
   block exactly.
4. When the spec defines a component state (hover, focus, disabled), include it.

# Output contract
**Must:** use named tokens; cover focus rings on interactive elements; respect the 8px base
spacing rhythm; render headlines in \`{typography.display-lg}\` only when the design.md narrative
calls for a hero treatment.

**Must NOT:** introduce new color tokens; use Tailwind utility defaults like \`bg-gray-50\`;
add emoji or marketing copy; invent a heading scale level the spec doesn't list.

# When in doubt
- Ask before adding a token.
- Prefer \`{colors.surface-container}\` over inventing a new background.
- Default to mobile-first; one breakpoint at 768px.

## Example B — bold consumer brand

# Role
You are an AI assistant generating UI for Vivid Music, a bold consumer media brand. Match
its energetic, high-contrast tone.

# How to use design.md
1. Use the YAML tokens for every value. Vivid's palette is deliberately saturated — pull
   \`{colors.primary}\` and \`{colors.accent}\` exactly.
2. Components use \`{rounded.lg}\` and \`{rounded.full}\` consistently; the brand reads round.
3. Headlines use \`{typography.display-lg}\` with the accent color underline pattern documented
   in Components.

# Output contract
**Must:** keep contrast >= 4.5:1 on body text per accessibility rules in the spec; respect
the full-bleed image treatment described under Imagery & Icons.

**Must NOT:** desaturate the palette; use system fonts; add minimal-style thin borders
(this brand uses color blocks, not outlines).

# When in doubt
- The brand prefers boldness; if torn between two options, pick the more confident one.
- Always include the accent underline on hero headlines.
- Surface conflicts with the Do's and Don'ts before silently overriding them.

# End of examples

Adapt the structure above to the brand you're given. Output the final companion prompt only —
no preamble, no commentary, no "Here is the companion prompt:" line.`;

interface Input {
  brandName: string;
  brand: ExtractedBrand;
  designStyles: string[];
}

interface SpecInput {
  brandName: string;
  /** The finished design.md spec text — ground truth for an existing bundle. */
  designMd: string;
  designStyles: string[];
}

const MAX_OUTPUT_TOKENS = 1500;

// Per-request timeout for ONE Sonnet attempt. The generate-companion worker is
// Vercel Pro maxDuration=300s (no watchdog), and the Anthropic SDK retries
// transient 429/5xx/timeout up to maxRetries (pinned to 2 in runCompanionSonnet).
// Worst case is 3 attempts × 90s + backoff ≈ 276s, which stays under the 300s
// SIGKILL so failJob() can mark the row `failed` first. A normal companion call
// returns in 10-20s; 90s is the ceiling so a slow-but-valid call isn't cut short.
const SONNET_TIMEOUT_MS = 90_000;

// Guards against a pathological design.md blowing the context window. A real
// design.md is a few KB; this cap (~10k tokens) never truncates a healthy spec.
const MAX_SPEC_CHARS = 40_000;

/**
 * Pipeline companion generator, driven by the structured brand JSON extracted
 * in Phase 1. Used by the parallel companion worker while DESIGN.md is authored.
 */
export async function generateCompanionPrompt(input: Input): Promise<string> {
  return runCompanionSonnet(buildBrandUserPrompt(input));
}

/**
 * Builds the user message for the JSON-driven (pipeline) companion path.
 * Exported so model-comparison tooling can reproduce the exact prompt.
 */
export function buildBrandUserPrompt(input: Input): string {
  const { brand } = input;
  const brandSummary = JSON.stringify(
    {
      name: brand.name,
      tagline: brand.tagline,
      brandTone: brand.brandTone,
      overview: brand.overview,
      designStyles: input.designStyles,
      colors: brand.colors.map((c) => ({ name: c.name, hex: c.hex, rationale: c.rationale })),
      typography: brand.typography.map((t) => ({
        name: t.name,
        fontFamily: t.fontFamily,
        rationale: t.rationale,
      })),
      rounded: brand.rounded.map((r) => ({ name: r.name, value: r.value })),
      spacing: brand.spacing.map((s) => ({ name: s.name, value: s.value })),
      components: brand.components.map((c) => c.name),
      layoutNotes: brand.layoutNotes,
      shapesNotes: brand.shapesNotes,
      dos: brand.dos,
      donts: brand.donts,
      voiceAndContent: brand.voiceAndContent ?? null,
      imageryStyle: brand.imageryStyle ?? null,
    },
    null,
    2,
  );

  return [
    `Brand: ${input.brandName}`,
    `Design styles: ${input.designStyles.join(', ') || '(none)'}`,
    '',
    'Brand tokens and identity (use these to write the companion):',
    '```json',
    brandSummary,
    '```',
    '',
    'Produce the companion prompt. Output only the markdown, no preamble.',
  ].join('\n');
}

/**
 * Companion generator for an EXISTING bundle, driven by its finished design.md
 * instead of the brand JSON. Used by the editor "regenerate companion" action,
 * where the original Phase-1 brand extraction is long gone — the design.md is
 * the only surviving source of truth, and it already carries every token by
 * name, so it's a complete substitute for the structured brand object.
 */
export async function generateCompanionPromptFromSpec(input: SpecInput): Promise<string> {
  return runCompanionSonnet(buildSpecUserPrompt(input));
}

/**
 * Builds the user message for the spec-driven (editor regenerate) companion
 * path. Exported so model-comparison tooling can reproduce the exact prompt.
 */
export function buildSpecUserPrompt(input: SpecInput): string {
  const spec = input.designMd.slice(0, MAX_SPEC_CHARS);
  return [
    `Brand: ${input.brandName}`,
    `Design styles: ${input.designStyles.join(', ') || '(none)'}`,
    '',
    'The design.md spec below is the ground truth. Write the companion that teaches an AI tool to apply it:',
    '```markdown',
    spec,
    '```',
    '',
    'Produce the companion prompt. Output only the markdown, no preamble.',
  ].join('\n');
}

/**
 * Shared Sonnet call for both companion paths: identical model, cached system
 * prompt, timeout, and text extraction — only the user message differs.
 *
 * Uses the .beta.messages endpoint because @anthropic-ai/sdk@0.32 only surfaces
 * typed `cache_control` on the beta path. Runtime behavior is identical to
 * .messages.create() on the same model — Sonnet 4.6 — and prompt caching is GA
 * on the Anthropic API. Upgrading the SDK to the current major would resolve
 * this but is out of scope.
 */
async function runCompanionSonnet(userPrompt: string): Promise<string> {
  const startedAt = Date.now();
  const res = await anthropic()
    .beta.messages.create(
      {
        model: ANTHROPIC_MODELS.sonnet,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: SONNET_TIMEOUT_MS, maxRetries: 2 },
    )
    .catch((err: unknown) => {
      // The SDK retries transient failures up to maxRetries internally, so this
      // elapsed spans all attempts: ~270000ms ≈ 3 × 90s means the companion
      // exhausted its retries on timeouts — that's the "companion times out".
      perf('companion.sonnet', 'err', Date.now() - startedAt, {
        timeoutMs: SONNET_TIMEOUT_MS,
        error: err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80),
      });
      throw err;
    });

  // cacheRead=0 on a warm process means the ephemeral system-prompt cache isn't
  // hitting (each generation re-pays full input); out near MAX_OUTPUT_TOKENS
  // means the model ran long writing an oversized companion.
  const u = res.usage;
  perf('companion.sonnet', 'ok', Date.now() - startedAt, {
    in: u?.input_tokens,
    out: u?.output_tokens,
    cacheRead: u?.cache_read_input_tokens,
    cacheWrite: u?.cache_creation_input_tokens,
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Sonnet returned empty companion prompt');
  return text;
}
