import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  bearerToken,
  generateApiKey,
  generateUserCode,
  hashSecret,
  normalizeUserCode,
} from "./keys";

describe("agent keys (#427)", () => {
  it("makes a random key and keeps only its hash and a short prefix", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(a.raw.length).toBeGreaterThan(40);
    expect(a.hash).toBe(hashSecret(a.raw));
    expect(a.hash).not.toContain(a.raw);
    expect(a.raw.startsWith(a.prefix)).toBe(true);
    expect(a.prefix.length).toBeLessThan(15);
  });

  it("reads only a Bearer header carrying a Ziki key", () => {
    expect(bearerToken("Bearer ziki_abc")).toBe("ziki_abc");
    expect(bearerToken("bearer   ziki_abc ")).toBe("ziki_abc");
    expect(bearerToken("Basic ziki_abc")).toBeNull();
    expect(bearerToken("Bearer sk-other")).toBeNull();
    expect(bearerToken("Bearer ziki_a ziki_b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it("makes user codes that survive being retyped loosely", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeUserCode(code.toLowerCase().replace("-", " "))).toBe(code.replace("-", ""));
    expect(normalizeUserCode("ABCD-234")).toBeNull();
    // Look-alike characters are never in a code, so they can't match one.
    expect(normalizeUserCode("ABCD-0O1I")).toBeNull();
  });
});
