/**
 * Anthropic client singleton. Used in Stage 2 of Phase 1C for companion
 * prompt generation (Sonnet 4.6) and the discovery classifier (Haiku 4.5).
 */
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export const ANTHROPIC_MODELS = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
} as const;
