/**
 * Sonnet 4.6 generates the companion prompt — the system-instruction
 * that teaches an AI coding tool how to apply the design.md spec when
 * generating new components.
 *
 * Output is plain markdown. The prompt is tool-agnostic but written so
 * it slots into Claude, Cursor, Lovable, and Figma Make.
 */
import { anthropic, ANTHROPIC_MODELS } from './anthropic';

const SYSTEM_PROMPT = `You write companion prompts for design system specs.

A companion prompt sits next to a design.md file and tells an AI coding tool how to use
that spec. It is read by Claude / Cursor / Lovable / Figma Make on every generation.

Structure your output as markdown with these sections:

# Role
One sentence: you are an AI assistant that generates UI for <brand>, using the design.md
spec as ground truth.

# How to use design.md
3–5 numbered rules: always reference tokens by name, never hardcode hex, etc.

# Output contract
Bullet list of what the AI must do (use tokens, respect constraints, include states) and
must NOT do (invent colors, use generic Tailwind classes, etc.).

# When in doubt
3–5 fallback rules. E.g. "If the spec doesn't define a value, ask the user before
inventing one." "Prefer composition over new tokens."

Rules:
- Be tool-agnostic. Don't reference Tailwind, Figma, or any one framework.
- ≤ 350 words total.
- No emojis. No marketing copy. No "you got this!" filler.
- The reader is an LLM, not a human; write like you'd write to a junior dev.`;

interface Input {
  brandName: string;
  designMd: string;
  designStyles: string[];
}

const MAX_OUTPUT_TOKENS = 1500;

// Per-request timeout. Vercel kills the generate-companion function at 60s.
// 45s gives the SDK time to throw inside the worker's try/catch and let
// failJob() update the row to `failed` before the platform SIGKILLs us.
// A normal companion call returns in 10-20s so this is ~3x healthy headroom.
const SONNET_TIMEOUT_MS = 45_000;

export async function generateCompanionPrompt(input: Input): Promise<string> {
  const userPrompt = [
    `Brand: ${input.brandName}`,
    `Design styles: ${input.designStyles.join(', ')}`,
    '',
    'design.md spec:',
    '```markdown',
    input.designMd.slice(0, 20_000),
    '```',
    '',
    'Produce the companion prompt. Output only the markdown, no preamble.',
  ].join('\n');

  const res = await anthropic().messages.create(
    {
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    { timeout: SONNET_TIMEOUT_MS },
  );

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Sonnet returned empty companion prompt');
  return text;
}
