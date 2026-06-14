/**
 * OpenRouter provider — a TEMPORARY, env-gated alternative to the direct
 * Google Gemini calls in `gemini.ts`.
 *
 * Why this exists: when the `GEMINI_API_KEY`'s Google project is denied
 * (403 PERMISSION_DENIED) we can't reach Gemini directly. OpenRouter exposes
 * the same Gemini models behind an OpenAI-compatible `/chat/completions` API,
 * so we route the extraction/authoring calls through it until Google billing
 * is restored. Flip back by setting `AI_PROVIDER=google` (the default).
 *
 * This is deliberately dependency-free (global `fetch`) and mirrors only what
 * the four Gemini call sites need: a system instruction, multimodal parts
 * (text + screenshot), optional structured-output schema, temperature,
 * max-tokens, a per-call timeout, and optional reasoning. Gemini-native
 * features we can't express here (explicit context caching, thinkingLevel)
 * are simply omitted on this path.
 */
import { env } from '@/lib/env';
import type { Part, Schema } from '@google/genai';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** True when the pipeline should route Gemini calls through OpenRouter. */
export function openRouterEnabled(): boolean {
  return env.AI_PROVIDER === 'openrouter';
}

type JsonSchema = Record<string, unknown>;

/**
 * Convert a `@google/genai` `Schema` (OpenAPI-subset, UPPERCASE `Type` enum,
 * `nullable` flags) into a standard JSON Schema that OpenRouter accepts in
 * `response_format.json_schema`. Keeps EXTRACTION_SCHEMA as the single source
 * of truth instead of maintaining a parallel schema.
 *
 * Nullable handling matters: nullable SCALARS become a `[t, 'null']` union
 * (well-supported), but nullable OBJECTS/ARRAYS drop the nullability entirely
 * and rely on being absent from the parent `required` list — emitting
 * `["object","null"]` alongside a full object body is the one shape that trips
 * Gemini-via-OpenRouter's structured-output layer.
 */
export function geminiSchemaToJsonSchema(schema: Schema): JsonSchema {
  const out: JsonSchema = {};
  const baseType = schema.type ? String(schema.type).toLowerCase() : undefined;

  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;

  if (baseType === 'object' && schema.properties) {
    out.type = 'object';
    const props: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      props[key] = geminiSchemaToJsonSchema(value as Schema);
    }
    out.properties = props;
    out.required = schema.required ?? [];
    out.additionalProperties = false;
    return out; // nullable objects → non-nullable; rely on absence from required
  }

  if (baseType === 'array' && schema.items) {
    out.type = 'array';
    out.items = geminiSchemaToJsonSchema(schema.items as Schema);
    return out; // nullable arrays → non-nullable; rely on absence from required
  }

  if (baseType) {
    out.type = schema.nullable ? [baseType, 'null'] : baseType;
  }
  return out;
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * Translate the Gemini `Part[]` the call sites already build into OpenAI-style
 * message content. `fetchImageAsPart` always yields `{ inlineData: {...} }`,
 * which becomes an `image_url` data URL.
 */
export function partsToOpenAIContent(parts: Part[]): OpenAIContentPart[] {
  const content: OpenAIContentPart[] = [];
  for (const part of parts) {
    if (typeof part.text === 'string') {
      content.push({ type: 'text', text: part.text });
    } else if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${part.inlineData.data}` },
      });
    }
  }
  return content;
}

export interface OpenRouterGenerateInput {
  /** System instruction (becomes the system message). */
  system: string;
  /** Gemini parts (text + optional inline image). */
  parts: Part[];
  /** When set, request structured JSON output enforced against this schema. */
  responseSchema?: Schema;
  temperature: number;
  maxOutputTokens?: number;
  /** Hard per-call timeout (AbortSignal). */
  timeoutMs: number;
  /**
   * Reasoning toggle. Defaults to using `OPENROUTER_REASONING_EFFORT`; pass
   * `false` to force-disable (e.g. cheap mechanical calls on a tight budget).
   */
  reasoning?: boolean;
}

export interface OpenRouterGenerateResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * One OpenRouter chat-completion. Throws on transport / API errors with the
 * HTTP status embedded in the message (and on `.status`) so `gemini.ts`'s
 * `withGeminiRetry` still detects and retries transient 429s. A 402
 * (insufficient credits) fails fast with an actionable message rather than
 * being retried.
 */
export async function openRouterGenerate(
  input: OpenRouterGenerateInput,
): Promise<OpenRouterGenerateResult> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured (AI_PROVIDER=openrouter)');
  }

  const useReasoning = (input.reasoning ?? true) && Boolean(env.OPENROUTER_REASONING_EFFORT);

  const body: Record<string, unknown> = {
    model: env.OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: partsToOpenAIContent(input.parts) },
    ],
    temperature: input.temperature,
    ...(input.maxOutputTokens ? { max_tokens: input.maxOutputTokens } : {}),
    ...(useReasoning ? { reasoning: { effort: env.OPENROUTER_REASONING_EFFORT } } : {}),
    ...(input.responseSchema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'extraction',
              strict: false,
              schema: geminiSchemaToJsonSchema(input.responseSchema),
            },
          },
        }
      : {}),
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
      'X-Title': 'uiuxskills.com',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  // Insufficient credits is permanent until a human tops up — fail fast with an
  // actionable message instead of letting the generic !ok path bury it.
  if (res.status === 402) {
    throw new Error(
      'OpenRouter credits exhausted (402) — top up at https://openrouter.ai/credits or set AI_PROVIDER=google.',
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(
      `OpenRouter ${res.status} ${res.statusText}: ${detail.slice(0, 500)}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    error?: { code?: number | string; message?: string };
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  // OpenRouter can return HTTP 200 with an `error` body (moderation, upstream
  // provider failure). Surface it; keep the code on `.status` for retry checks.
  if (data.error) {
    const err = new Error(
      `OpenRouter error ${data.error.code ?? ''}: ${data.error.message ?? 'unknown'}`,
    ) as Error & { status?: number | string };
    err.status = data.error.code;
    throw err;
  }

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(
      `OpenRouter returned no message content: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  return { text, usage: data.usage };
}
