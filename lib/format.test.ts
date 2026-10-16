import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

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
