import { consumeRateLimit, type RateLimitConfig } from "@/lib/rate-limit";

/**
 * Abuse limits on agent sign-up (#427), in the shared rate-limit store. These
 * guard pairing, which runs before an agent has a key; an agent's request
 * budgets once it has one are #440's (lib/agents/rate-budget.ts).
 */
const MINUTE = 60 * 1000;

export const PAIRING_RATE_LIMITS = {
  /** Starting a pairing, per client IP. */
  start: { max: 10, windowMs: 15 * MINUTE },
  /** The waiting agent polling for its key, per client IP. */
  collect: { max: 120, windowMs: MINUTE },
  /** Approval attempts per signed-in person, so codes can't be guessed. */
  approve: { max: 10, windowMs: 15 * MINUTE },
} as const satisfies Record<string, RateLimitConfig>;

export type PairingLimit = keyof typeof PAIRING_RATE_LIMITS;

/** Seconds to wait, or null when the attempt is allowed. */
export async function consumePairingLimit(
  limit: PairingLimit,
  who: string,
  now = Date.now(),
): Promise<number | null> {
  const result = await consumeRateLimit(`agent-pairing:${limit}:${who}`, PAIRING_RATE_LIMITS[limit], now);
  return result.allowed ? null : Math.max(1, Math.ceil(result.retryAfterMs / 1000));
}
