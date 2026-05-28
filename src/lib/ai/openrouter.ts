/**
 * OpenRouter chat-completion client.
 *
 * OpenRouter exposes hundreds of models behind an OpenAI-compatible API.
 * We use it for the author step (DESIGN.md body generation) where we
 * traded Claude Sonnet 4.6 for Gemini 3.1 Flash-Lite — ~3x faster and
 * different provider, which diversifies away from Anthropic outages.
 *
 * Why not use the `openai` npm package? OpenRouter is a single endpoint
 * with a tiny request/response shape — a 40-line fetch wrapper is
 * easier to reason about than dragging in an SDK that would need a
 * baseURL override anyway.
 *
 * Companion-prompt and discovery classifier remain on Anthropic direct.
 */
import { env } from '@/lib/env';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Default model for author-step generation. Swap this constant to
 * change the model across all callers. OpenRouter model IDs:
 * https://openrouter.ai/models
 *
 * Options worth considering:
 *   - google/gemini-3.1-flash-lite (current — low-latency, cost-effective,
 *                                   hits checklist with the strong prompt from generate-design-md.ts)
 *   - google/gemini-2.5-pro      (~60-90s via OpenRouter — too slow for our
 *                                 50s in-process timeout, exceeded watchdog
 *                                 in production)
 *   - openai/gpt-5-mini          (~15-25s, OpenAI voice, strong structure)
 *   - anthropic/claude-haiku-4-5 (~15-20s, back to Anthropic but Haiku tier)
 *   - anthropic/claude-sonnet-4-6 (~25-35s baseline quality, original choice)
 *
 * Initially used flash, then switched to pro after Flash skipped Elevation
 * and Do's & Don'ts sections. Pro adhered to the checklist but was so slow
 * it timed out repeatedly in prod (220s+ wall clock with QStash retries).
 * Returning to Flash now that the system prompt has an explicit
 * [ ] checklist of required headings — that visual checklist gives Flash
 * the structural cue it was missing the first time.
 */
export const OPENROUTER_AUTHOR_MODEL = 'google/gemini-3.1-flash-lite';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionInput {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  /** Hard timeout in ms. Aborts the underlying fetch when exceeded. */
  timeoutMs?: number;
}

export interface ChatCompletionResult {
  content: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelUsed: string;
}

interface OpenRouterResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string | number };
}

export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const body = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.max_tokens,
    temperature: input.temperature ?? 0.7,
  };

  const signal = input.timeoutMs ? AbortSignal.timeout(input.timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // OpenRouter uses these headers to attribute traffic on their
        // dashboard — useful for observability, optional for the API.
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': 'UIUXskills',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // AbortSignal.timeout rejects with a TimeoutError DOMException; surface
    // a clean message so the worker's try/catch can route to failJob.
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`OpenRouter request timed out after ${input.timeoutMs}ms`);
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as OpenRouterResponse;

  if (json.error) {
    throw new Error(`OpenRouter error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  const content = json.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error(`OpenRouter returned empty content (model=${json.model ?? input.model})`);
  }

  return {
    content,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    },
    modelUsed: json.model ?? input.model,
  };
}
