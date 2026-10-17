import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";

afterEach(() => vi.unstubAllEnvs());

describe("sitemap", () => {
  it("lists absolute URLs on the configured site, not the request host", () => {
    vi.stubEnv("AUTH_URL", "https://issues.zedu.chat");
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(["https://issues.zedu.chat"]);
  });

  it("never lists an issue page", () => {
    vi.stubEnv("AUTH_URL", "https://issues.zedu.chat");
    expect(sitemap().some((entry) => entry.url.includes("/bugs"))).toBe(false);
  });

  it("lists nothing robots.txt disallows", () => {
    // Listing a blocked URL earns "Submitted URL blocked by robots.txt".
    vi.stubEnv("AUTH_URL", "https://issues.zedu.chat");
    const rules = robots().rules;
    const disallowed = (Array.isArray(rules) ? rules : [rules]).flatMap((rule) =>
      Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : [],
    );
    for (const { url } of sitemap()) {
      const path = new URL(url).pathname;
      for (const blocked of disallowed) {
        expect(path.startsWith(blocked), `${path} is blocked by ${blocked}`).toBe(false);
      }
    }
  });
});

describe("robots", () => {
  it("points at the sitemap on the configured origin", () => {
    vi.stubEnv("AUTH_URL", "https://issues.zedu.chat");
    expect(robots().sitemap).toBe("https://issues.zedu.chat/sitemap.xml");
  });
});
