import { describe, expect, it } from "vitest";
import { formatDate, formatRelativeTime } from "./format";

describe("formatDate", () => {
  it("formats dates with custom timezone", () => {
    // 18:30 UTC is 19:30 in Africa/Lagos (UTC+1)
    const utcDate = new Date("2026-10-15T18:30:00Z");
    const formattedLagos = formatDate(utcDate, "Africa/Lagos");
    expect(formattedLagos).toBe("Oct 15, 2026, 7:30 PM");

    // 18:30 UTC is 18:30 in UTC
    const formattedUtc = formatDate(utcDate, "UTC");
    expect(formattedUtc).toBe("Oct 15, 2026, 6:30 PM");

    // 18:30 UTC is 14:30 in America/New_York (EDT, UTC-4)
    const formattedNy = formatDate(utcDate, "America/New_York");
    expect(formattedNy).toBe("Oct 15, 2026, 2:30 PM");
  });

  it("handles string date inputs", () => {
    const formatted = formatDate("2026-10-15T18:30:00Z", "Africa/Lagos");
    expect(formatted).toBe("Oct 15, 2026, 7:30 PM");
  });
});

describe("formatRelativeTime", () => {
  const base = new Date("2026-10-20T12:00:00Z");

  it("formats seconds as just now", () => {
    const date = new Date("2026-10-20T11:59:45Z");
    expect(formatRelativeTime(date, base)).toBe("just now");
  });

  it("formats minutes ago", () => {
    const date = new Date("2026-10-20T11:57:00Z");
    expect(formatRelativeTime(date, base)).toBe("3 min ago");
  });

  it("formats hours ago", () => {
    const date = new Date("2026-10-20T10:00:00Z");
    expect(formatRelativeTime(date, base)).toBe("2 hrs ago");
    const oneHour = new Date("2026-10-20T11:00:00Z");
    expect(formatRelativeTime(oneHour, base)).toBe("1 hr ago");
  });

  it("formats days ago", () => {
    const date = new Date("2026-10-17T12:00:00Z");
    expect(formatRelativeTime(date, base)).toBe("3 days ago");
    const oneDay = new Date("2026-10-19T12:00:00Z");
    expect(formatRelativeTime(oneDay, base)).toBe("1 day ago");
  });
});
