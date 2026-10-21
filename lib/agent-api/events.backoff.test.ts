import { describe, expect, it } from "vitest";
import {
  EVENT_MAX_POLL_INTERVAL_MS,
  EVENT_POLL_INTERVAL_MS,
  nextPollDelayMs,
} from "./events";

/** The long poll backs off instead of querying the database every 500 ms (#545). */
describe("long-poll backoff (#545)", () => {
  it("starts fast so new events still arrive with low latency", () => {
    expect(nextPollDelayMs(0)).toBe(EVENT_POLL_INTERVAL_MS);
  });

  it("doubles the interval until the cap", () => {
    expect(nextPollDelayMs(1)).toBe(1_000);
    expect(nextPollDelayMs(2)).toBe(2_000);
    expect(nextPollDelayMs(3)).toBe(EVENT_MAX_POLL_INTERVAL_MS);
    expect(nextPollDelayMs(50)).toBe(EVENT_MAX_POLL_INTERVAL_MS);
  });

  it("treats nonsense attempts as the first poll", () => {
    expect(nextPollDelayMs(-1)).toBe(EVENT_POLL_INTERVAL_MS);
    expect(nextPollDelayMs(Number.NaN)).toBe(EVENT_POLL_INTERVAL_MS);
  });
});
