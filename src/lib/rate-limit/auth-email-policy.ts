import { createHmac } from 'node:crypto';
import { redisRateLimitConfiguration, type RateLimitConfiguration } from './config';

export const EMAIL_IP_LIMIT = {
  limit: 5,
  window: '10 m' as const,
  prefix: 'rl:auth-email:ip',
};

export const EMAIL_ADDRESS_LIMIT = {
  limit: 3,
  window: '1 h' as const,
  prefix: 'rl:auth-email:address',
};

export function normalizeEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns an opaque HMAC digest; raw email addresses never enter Redis keys. */
export function emailRateLimitKey(email: string, secret: string): string {
  return createHmac('sha256', secret).update(normalizeEmailForRateLimit(email)).digest('hex');
}

export function rateLimitConfiguration(input: {
  nodeEnv: string;
  redisUrl?: string;
  redisToken?: string;
  secret?: string;
}): RateLimitConfiguration {
  const redisConfiguration = redisRateLimitConfiguration(input);
  if (redisConfiguration !== 'configured') return redisConfiguration;
  return input.secret ? 'configured' : input.nodeEnv === 'production' ? 'unavailable' : 'disabled';
}
