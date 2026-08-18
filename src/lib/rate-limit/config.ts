export type RateLimitConfiguration = 'configured' | 'disabled' | 'unavailable';

export function redisRateLimitConfiguration(input: {
  nodeEnv: string;
  redisUrl?: string;
  redisToken?: string;
}): RateLimitConfiguration {
  if (input.redisUrl && input.redisToken) return 'configured';
  return input.nodeEnv === 'production' ? 'unavailable' : 'disabled';
}
