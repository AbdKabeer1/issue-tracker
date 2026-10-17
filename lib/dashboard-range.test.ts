import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
  formatDateParam,
  formatDuration,
  isPreset,
  parseDateParam,
  parseDateRange,
  presetRange,
} from "./dashboard-range";

const NOW = new Date("2026-10-17T06:59:00.000Z");
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("parseDateParam", () => {
  it("accepts a YYYY-MM-DD date at UTC midnight", () => {
    expect(parseDateParam("2026-03-04")).toEqual(day("2026-03-04"));
    expect(parseDateParam("  2026-03-04 ")).toEqual(day("2026-03-04"));
  });

  it("rejects anything that is not that shape", () => {
    for (const bad of ["", "today", "2026-3-4", "04/03/2026", null, undefined, 20260304]) {
      expect(parseDateParam(bad), String(bad)).toBeNull();
    }
  });

  it("rejects a date that does not exist", () => {
    // Date would otherwise roll 2026-02-31 forward into March and report a
    // range nobody asked for.
    expect(parseDateParam("2026-02-31")).toBeNull();
    expect(parseDateParam("2026-13-01")).toBeNull();
    expect(parseDateParam("2026-00-10")).toBeNull();
  });

  it("round-trips through formatDateParam", () => {
    expect(formatDateParam(parseDateParam("2026-03-04")!)).toBe("2026-03-04");
  });
});

describe("parseDateRange", () => {
  it("defaults to the last 90 days ending today", () => {
    const range = parseDateRange({}, NOW);
    expect(range.days).toBe(DEFAULT_RANGE_DAYS);
    expect(formatDateParam(range.from)).toBe("2026-07-20");
    // The end is exclusive, so today is fully included.
    expect(formatDateParam(range.to)).toBe("2026-10-18");
  });

  it("includes the whole of the last day asked for", () => {
    const range = parseDateRange({ from: "2026-10-01", to: "2026-10-07" }, NOW);
    expect(formatDateParam(range.to)).toBe("2026-10-08");
    expect(range.days).toBe(7);
  });

  it("reads a backwards range as the one the user meant", () => {
    const backwards = parseDateRange({ from: "2026-10-07", to: "2026-10-01" }, NOW);
    const forwards = parseDateRange({ from: "2026-10-01", to: "2026-10-07" }, NOW);
    expect(backwards).toEqual(forwards);
  });

  it("falls back rather than erroring on a hand-edited URL", () => {
    const range = parseDateRange({ from: "yesterday", to: "2026-02-31" }, NOW);
    expect(range.days).toBe(DEFAULT_RANGE_DAYS);
  });

  it("caps a range that would be too wide to render", () => {
    const range = parseDateRange({ from: "2001-01-01", to: "2026-10-17" }, NOW);
    expect(range.days).toBe(MAX_RANGE_DAYS);
    expect(formatDateParam(range.to)).toBe("2026-10-18");
  });

  it("accepts one end without the other", () => {
    const fromOnly = parseDateRange({ from: "2026-10-10" }, NOW);
    expect(formatDateParam(fromOnly.from)).toBe("2026-10-10");
    expect(formatDateParam(fromOnly.to)).toBe("2026-10-18");

    const toOnly = parseDateRange({ to: "2026-10-10" }, NOW);
    expect(formatDateParam(toOnly.to)).toBe("2026-10-11");
  });

  it("handles a single day", () => {
    const range = parseDateRange({ from: "2026-10-17", to: "2026-10-17" }, NOW);
    expect(range.days).toBe(1);
  });
});

describe("presetRange and isPreset", () => {
  it("marks the preset the current range matches, and only that one", () => {
    const thirty = presetRange(30, NOW);
    expect(isPreset(thirty, 30, NOW)).toBe(true);
    expect(isPreset(thirty, 7, NOW)).toBe(false);
  });

  it("does not mark a custom range as a preset", () => {
    const custom = parseDateRange({ from: "2026-09-01", to: "2026-09-20" }, NOW);
    expect(isPreset(custom, 7, NOW)).toBe(false);
    expect(isPreset(custom, 30, NOW)).toBe(false);
  });
});

describe("formatDuration", () => {
  it("picks the largest unit that fits", () => {
    expect(formatDuration(3 * 86400)).toBe("3 days");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(5400)).toBe("1.5 hours");
    expect(formatDuration(2700)).toBe("45 minutes");
    expect(formatDuration(30)).toBe("under a minute");
  });

  it("has nothing to say when there is no figure", () => {
    // No resolved issues in range means no median, which is not zero.
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });
});
