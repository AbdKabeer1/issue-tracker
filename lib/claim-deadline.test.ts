import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliveryDeadline,
  deliveryWindowMinutes,
  extendDeadline,
  isDeliveryOverdue,
  remainingLabel,
  DEFAULT_DELIVERY_WINDOW_MINUTES,
  HIGH_PRIORITY_DELIVERY_WINDOW_MINUTES,
} from "./claim-deadline";

const now = new Date("2026-10-19T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("claim delivery deadline (#593)", () => {
  it("defaults to 15 minutes but gives high and critical work an hour", () => {
    expect(deliveryWindowMinutes("low")).toBe(DEFAULT_DELIVERY_WINDOW_MINUTES);
    expect(deliveryWindowMinutes("medium")).toBe(15);
    expect(deliveryWindowMinutes("high")).toBe(HIGH_PRIORITY_DELIVERY_WINDOW_MINUTES);
    expect(deliveryWindowMinutes("critical")).toBe(60);
  });

  it("lets a project widen the window, never narrowing high-priority work below 60", () => {
    expect(deliveryWindowMinutes("low", 30)).toBe(30);
    expect(deliveryWindowMinutes("high", 30)).toBe(60);
    expect(deliveryWindowMinutes("high", 90)).toBe(90);
    expect(deliveryWindowMinutes("low", 0)).toBe(15);
    expect(deliveryWindowMinutes("low", Number.NaN)).toBe(15);
  });

  it("counts the deadline from acceptance", () => {
    expect(deliveryDeadline(now, 15)).toEqual(new Date("2026-10-19T12:15:00.000Z"));
    expect(deliveryDeadline(now, 60)).toEqual(new Date("2026-10-19T13:00:00.000Z"));
  });

  it("adds the same window again from the current deadline, not from now", () => {
    const current = new Date("2026-10-19T12:10:00.000Z");
    vi.advanceTimersByTime(5 * 60_000);
    expect(extendDeadline(current, 15)).toEqual(new Date("2026-10-19T12:25:00.000Z"));
  });

  it("is overdue at the deadline and not one millisecond before", () => {
    const deadline = new Date("2026-10-19T12:15:00.000Z");
    expect(isDeliveryOverdue(deadline, new Date(deadline.getTime() - 1))).toBe(false);
    expect(isDeliveryOverdue(deadline, deadline)).toBe(true);
    expect(isDeliveryOverdue(null, now)).toBe(false);
  });

  it("labels the time left for the issue page", () => {
    expect(remainingLabel(new Date("2026-10-19T12:12:00.000Z"), now)).toBe("12m left");
    expect(remainingLabel(new Date("2026-10-19T13:05:00.000Z"), now)).toBe("1h 5m left");
    expect(remainingLabel(new Date("2026-10-19T13:00:00.000Z"), now)).toBe("1h left");
    expect(remainingLabel(new Date("2026-10-19T11:59:00.000Z"), now)).toBe("Overdue");
    expect(remainingLabel(null, now)).toBeNull();
  });
});
