import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMITS,
  consumeAuthRateLimit,
  consumeRateLimit,
  rateLimitStoreName,
  resetRateLimits,
  setRateLimitStore,
  type RateLimitConfig,
  type RateLimitStore,
} from "./rate-limit";

/**
 * A stand-in for the Postgres table: one store object shared by every
 * "instance", with the same sliding-window rules. The real store is
 * exercised against Postgres in the PR's verification; this pins the
 * contract the callers rely on.
 */
function sharedStore(): RateLimitStore & { rows: Map<string, number[]> } {
  const rows = new Map<string, number[]>();
  return {
    rows,
    async hit(key: string, config: RateLimitConfig, now: number) {
      const live = (rows.get(key) ?? []).filter((t) => t > now - config.windowMs);
      if (live.length >= config.max) {
        return { allowed: false, retryAfterMs: live[0] + config.windowMs - now };
      }
      rows.set(key, [...live, now]);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

beforeEach(() => resetRateLimits());
afterEach(() => setRateLimitStore(null));

describe("rateLimitStoreName", () => {
  it("defaults to postgres in production and memory elsewhere", () => {
    expect(rateLimitStoreName({ NODE_ENV: "production" })).toBe("postgres");
    expect(rateLimitStoreName({ NODE_ENV: "development" })).toBe("memory");
    expect(rateLimitStoreName({ NODE_ENV: "test" })).toBe("memory");
  });
  it("honours RATE_LIMIT_STORE either way, and ignores nonsense", () => {
    expect(rateLimitStoreName({ NODE_ENV: "production", RATE_LIMIT_STORE: "memory" })).toBe("memory");
    expect(rateLimitStoreName({ NODE_ENV: "development", RATE_LIMIT_STORE: " Postgres " })).toBe("postgres");
    expect(rateLimitStoreName({ NODE_ENV: "production", RATE_LIMIT_STORE: "redis" })).toBe("postgres");
  });
});

describe("consumeRateLimit with a shared store", () => {
  const config = { max: 3, windowMs: 1000 };

  it("counts attempts from every instance against one limit", async () => {
    const store = sharedStore();
    setRateLimitStore(store);
    // Alternate "instances": with per-process memory each would allow 3.
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await consumeRateLimit("k", config, 100 + i)).allowed);
    expect(results).toEqual([true, true, true, false, false, false]);
  });

  it("keeps counting across a restart (the store outlives the process)", async () => {
    const store = sharedStore();
    setRateLimitStore(store);
    await consumeRateLimit("k", config, 100);
    await consumeRateLimit("k", config, 101);
    resetRateLimits(); // what a restart does to the in-memory limiter
    await consumeRateLimit("k", config, 102);
    expect((await consumeRateLimit("k", config, 103)).allowed).toBe(false);
  });

  it("falls back to this instance's memory when the store fails — never blocks everyone", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitStore({ hit: async () => Promise.reject(new Error("db down")) });
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await consumeRateLimit("k", config, 5000 + i)).allowed);
    // Still limited (by memory), and the first attempts all go through.
    expect(results).toEqual([true, true, true, false]);
    // Logged once, not once per request.
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe("consumeAuthRateLimit", () => {
  it("applies the per-email limit across IPs, as checkAuthRateLimit does", async () => {
    setRateLimitStore(sharedStore());
    const max = AUTH_RATE_LIMITS.login.email.max;
    for (let i = 0; i < max; i++) {
      const r = await consumeAuthRateLimit("login", { email: "A@x.test", ip: `10.0.0.${i}` }, 1000 + i);
      expect(r.allowed).toBe(true);
    }
    const blocked = await consumeAuthRateLimit("login", { email: "a@x.test ", ip: "10.0.1.1" }, 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("uses the in-memory limiter when no store is configured (dev, tests)", async () => {
    const max = AUTH_RATE_LIMITS.signup.email.max;
    for (let i = 0; i < max; i++) await consumeAuthRateLimit("signup", { email: "b@x.test" }, 10 + i);
    expect((await consumeAuthRateLimit("signup", { email: "b@x.test" }, 50)).allowed).toBe(false);
  });
});
