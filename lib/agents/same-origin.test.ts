import { afterEach, describe, expect, it, vi } from "vitest";
import { isCrossSiteRequest } from "./same-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

function headers(values: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

describe("isCrossSiteRequest (#654)", () => {
  it("allows clients that send neither Origin nor Referer", () => {
    vi.stubEnv("AUTH_URL", "https://ziki.dev");
    expect(isCrossSiteRequest(headers({}))).toBe(false);
  });

  it("allows the app's own origin", () => {
    vi.stubEnv("AUTH_URL", "https://ziki.dev");
    expect(isCrossSiteRequest(headers({ origin: "https://ziki.dev" }))).toBe(false);
    expect(isCrossSiteRequest(headers({ referer: "https://ziki.dev/settings/agents" }))).toBe(false);
  });

  it("rejects a different origin, and prefers Origin over Referer", () => {
    vi.stubEnv("AUTH_URL", "https://ziki.dev");
    expect(isCrossSiteRequest(headers({ origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteRequest(headers({ referer: "https://evil.example/phish" }))).toBe(true);
    expect(
      isCrossSiteRequest(headers({ origin: "https://ziki.dev", referer: "https://evil.example/" })),
    ).toBe(false);
  });

  it("rejects a header that is not a URL", () => {
    vi.stubEnv("AUTH_URL", "https://ziki.dev");
    expect(isCrossSiteRequest(headers({ origin: "not a url" }))).toBe(true);
  });
});
