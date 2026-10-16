import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimits,
  RATE_LIMIT_MESSAGE,
} from "./rate-limit";

describe("rate-limiting (#130)", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("has friendly error message", () => {
    expect(RATE_LIMIT_MESSAGE).toContain("You're doing that too fast");
  });

  it("allows actions within the limit", () => {
    const config = { max: 3, windowMs: 1000 };
    expect(checkRateLimit("user-1", config, 100).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 200).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 300).allowed).toBe(true);
  });

  it("blocks actions exceeding the limit in the window", () => {
    const config = { max: 2, windowMs: 1000 };
    expect(checkRateLimit("user-1", config, 100).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 200).allowed).toBe(true);

    const blocked = checkRateLimit("user-1", config, 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window expires", () => {
    const config = { max: 2, windowMs: 1000 };
    expect(checkRateLimit("user-1", config, 100).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 200).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 300).allowed).toBe(false);

    // After 1000ms window from first request
    expect(checkRateLimit("user-1", config, 1200).allowed).toBe(true);
  });

  it("tracks rate limits separately for different users", () => {
    const config = { max: 1, windowMs: 1000 };
    expect(checkRateLimit("user-1", config, 100).allowed).toBe(true);
    expect(checkRateLimit("user-1", config, 200).allowed).toBe(false);
    expect(checkRateLimit("user-2", config, 200).allowed).toBe(true);
  });
});
