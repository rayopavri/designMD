/**
 * Human-readable label for the model the generation pipeline currently uses,
 * so UI copy tracks AI_PROVIDER automatically instead of being hardcoded:
 *   - AI_PROVIDER=openrouter → OPENROUTER_MODEL (e.g. "Gemini 3.5 Flash")
 *   - AI_PROVIDER=google     → the direct-Gemini MODEL in src/lib/ai/gemini.ts
 *
 * Server-only (reads env). Pass the result to client components as a prop.
 */
import { env } from '@/lib/env';

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
  'google/gemini-3.5-flash': 'Gemini 3.5 Flash',
  'google/gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
};

/** Fallback for unmapped slugs: "google/gemini-3.5-flash" → "Gemini 3.5 Flash". */
function prettifyModelSlug(slug: string): string {
  const base = slug.includes('/') ? slug.slice(slug.indexOf('/') + 1) : slug;
  return base
    .split('-')
    .map((part) => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function activeModelLabel(): string {
  // The google branch must stay in sync with MODEL in src/lib/ai/gemini.ts.
  const id = env.AI_PROVIDER === 'openrouter' ? env.OPENROUTER_MODEL : 'gemini-3.1-flash-lite';
  return MODEL_LABELS[id] ?? prettifyModelSlug(id);
}
