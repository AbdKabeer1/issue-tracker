export const RATE_LIMIT_MESSAGE =
  "You're doing that too fast. Please wait a moment.";

export type RateLimitConfig = {
  max: number;
  windowMs: number;
};

export const ACTION_RATE_LIMITS = {
  createBug: { max: 10, windowMs: 60 * 1000 },
  addComment: { max: 20, windowMs: 60 * 1000 },
  toggleVote: { max: 60, windowMs: 60 * 1000 },
} as const;

const tracker = new Map<string, number[]>();

/**
 * Sliding window rate limiter for user actions.
 * Automatically evicts timestamps older than windowMs.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): { allowed: boolean; retryAfterMs: number } {
  const windowStart = now - config.windowMs;
  const timestamps = (tracker.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= config.max) {
    const oldest = timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + config.windowMs - now);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  tracker.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

/** Reset rate limit tracker (useful for testing). */
export function resetRateLimits(): void {
  tracker.clear();
}
