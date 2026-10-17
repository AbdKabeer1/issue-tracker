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

const MINUTE = 60 * 1000;

/**
 * Limits for the sign-in, sign-up and password-reset actions (#207). Each is
 * checked twice, per email address and per client IP, so one attacker can't
 * hammer one account and can't spray many accounts from one address.
 */
export const AUTH_RATE_LIMITS = {
  login: { email: { max: 10, windowMs: 15 * MINUTE }, ip: { max: 30, windowMs: 15 * MINUTE } },
  signup: { email: { max: 3, windowMs: 60 * MINUTE }, ip: { max: 10, windowMs: 60 * MINUTE } },
  forgotPassword: { email: { max: 3, windowMs: 15 * MINUTE }, ip: { max: 10, windowMs: 15 * MINUTE } },
  resetPassword: { email: { max: 10, windowMs: 15 * MINUTE }, ip: { max: 20, windowMs: 15 * MINUTE } },
} as const;

export type AuthRateLimitAction = keyof typeof AUTH_RATE_LIMITS;

const tracker = new Map<string, number[]>();

/** Bound memory use: past this many keys, drop the ones whose window has passed. */
const MAX_TRACKED_KEYS = 10_000;
const LONGEST_WINDOW_MS = 60 * MINUTE;

function pruneExpired(now: number) {
  for (const [key, timestamps] of tracker) {
    const latest = timestamps[timestamps.length - 1] ?? 0;
    if (latest <= now - LONGEST_WINDOW_MS) tracker.delete(key);
  }
}

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
  if (tracker.size > MAX_TRACKED_KEYS) pruneExpired(now);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Checks an auth action against both its per-email and per-IP limits (#207).
 * Either limit being hit blocks the attempt.
 */
export function checkAuthRateLimit(
  action: AuthRateLimitAction,
  { email, ip }: { email?: string | null; ip?: string | null },
  now = Date.now(),
): { allowed: boolean; retryAfterMs: number } {
  const limits = AUTH_RATE_LIMITS[action];
  const checks = [
    email ? checkRateLimit(`auth:${action}:email:${email.trim().toLowerCase()}`, limits.email, now) : null,
    ip ? checkRateLimit(`auth:${action}:ip:${ip}`, limits.ip, now) : null,
  ].filter((c): c is { allowed: boolean; retryAfterMs: number } => c !== null);

  const blocked = checks.filter((c) => !c.allowed);
  if (blocked.length === 0) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: Math.max(...blocked.map((c) => c.retryAfterMs)) };
}

/**
 * Best-effort client IP from proxy headers (first `x-forwarded-for` entry,
 * else `x-real-ip`). It's only used as a rate-limit key, never for access
 * decisions, so a spoofed value at worst gives an attacker their own bucket;
 * the per-email limit still applies.
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

// ---------------------------------------------------------------------------
// Shared store (#296)
//
// The functions above keep their window in this process's memory, so with
// several instances each one has its own counters and a deploy resets them
// all. The async functions below use a store shared by every instance — a
// Postgres table — and fall back to the in-memory limiter if that store
// fails, so an outage degrades to per-instance limits, never to blocking
// everyone and never to no limit at all.
// ---------------------------------------------------------------------------

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export type RateLimitStore = {
  hit(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult>;
};

export type RateLimitStoreName = "postgres" | "memory";

/**
 * `RATE_LIMIT_STORE=postgres|memory`. Unset: Postgres in production, memory
 * everywhere else (dev, tests), so local work and the existing tests don't
 * need the table.
 */
export function rateLimitStoreName(
  env: { RATE_LIMIT_STORE?: string; NODE_ENV?: string } = process.env,
): RateLimitStoreName {
  const chosen = env.RATE_LIMIT_STORE?.trim().toLowerCase();
  if (chosen === "postgres" || chosen === "memory") return chosen;
  return env.NODE_ENV === "production" ? "postgres" : "memory";
}

const memoryStore: RateLimitStore = {
  hit: async (key, config, now) => checkRateLimit(key, config, now),
};

let storeOverride: RateLimitStore | null = null;

/** Replace the store (tests). Pass null to go back to the configured one. */
export function setRateLimitStore(store: RateLimitStore | null): void {
  storeOverride = store;
}

async function configuredStore(): Promise<RateLimitStore> {
  if (storeOverride) return storeOverride;
  if (rateLimitStoreName() === "memory") return memoryStore;
  // Loaded lazily so code and tests that only use the in-memory limiter
  // never import Prisma.
  const { postgresRateLimitStore } = await import("./rate-limit-postgres");
  return postgresRateLimitStore;
}

let lastStoreErrorAt: number | null = null;

/**
 * Records one attempt against `key` in the shared store and says whether
 * it's allowed. If the store fails, the in-memory limiter answers instead.
 */
export async function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): Promise<RateLimitResult> {
  const store = await configuredStore();
  if (store === memoryStore) return checkRateLimit(key, config, now);
  try {
    const result = await store.hit(key, config, now);
    if (typeof result?.allowed !== "boolean") throw new Error("rate-limit store returned no result");
    return result;
  } catch (error) {
    // Once a minute is enough to notice; every request would flood the log.
    if (lastStoreErrorAt === null || now - lastStoreErrorAt > MINUTE) {
      lastStoreErrorAt = now;
      console.error("[rate-limit] shared store failed; using this instance's memory", error);
    }
    return checkRateLimit(key, config, now);
  }
}

/** `checkAuthRateLimit`, against the shared store. */
export async function consumeAuthRateLimit(
  action: AuthRateLimitAction,
  { email, ip }: { email?: string | null; ip?: string | null },
  now = Date.now(),
): Promise<RateLimitResult> {
  const limits = AUTH_RATE_LIMITS[action];
  const checks = await Promise.all([
    email
      ? consumeRateLimit(`auth:${action}:email:${email.trim().toLowerCase()}`, limits.email, now)
      : null,
    ip ? consumeRateLimit(`auth:${action}:ip:${ip}`, limits.ip, now) : null,
  ]);
  const blocked = checks.filter((c): c is RateLimitResult => c !== null && !c.allowed);
  if (blocked.length === 0) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: Math.max(...blocked.map((c) => c.retryAfterMs)) };
}

/** The longest window any limit uses; shared-store rows older than this are dead. */
export const RATE_LIMIT_RETENTION_MS = LONGEST_WINDOW_MS;

/** Number of keys currently tracked (for tests). */
export function trackedKeyCount(): number {
  return tracker.size;
}

/** Reset rate limit tracker (useful for testing). */
export function resetRateLimits(): void {
  tracker.clear();
}
