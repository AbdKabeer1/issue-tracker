import { describe, expect, it } from "vitest";
import { cleanEnv } from "./env-clean";

describe("cleanEnv", () => {
  it("returns undefined for null or undefined", () => {
    expect(cleanEnv(undefined)).toBeUndefined();
    expect(cleanEnv(null)).toBeUndefined();
  });

  it("returns undefined for empty or whitespace-only strings", () => {
    expect(cleanEnv("")).toBeUndefined();
    expect(cleanEnv("   ")).toBeUndefined();
    expect(cleanEnv('""')).toBeUndefined();
    expect(cleanEnv("''")).toBeUndefined();
  });

  it("trims whitespace from unquoted strings", () => {
    expect(cleanEnv("  valid_secret  ")).toBe("valid_secret");
  });

  it("strips double quotes and whitespace", () => {
    expect(cleanEnv('"GOCSPX-12345abcdef"')).toBe("GOCSPX-12345abcdef");
    expect(cleanEnv('  "GOCSPX-12345abcdef"  ')).toBe("GOCSPX-12345abcdef");
  });

  it("strips single quotes and whitespace", () => {
    expect(cleanEnv("'GOCSPX-12345abcdef'")).toBe("GOCSPX-12345abcdef");
    expect(cleanEnv("  'GOCSPX-12345abcdef'  ")).toBe("GOCSPX-12345abcdef");
  });

  it("preserves legitimate interior characters", () => {
    expect(cleanEnv('"secret-with-internal-quote-\'test\'"')).toBe(
      "secret-with-internal-quote-'test'",
    );
  });
});
