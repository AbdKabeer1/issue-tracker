import { describe, expect, it } from "vitest";
import { BCRYPT_MAX_PASSWORD_BYTES, truncatePasswordToBcryptLimit } from "./password";

/** bcrypt silently uses only the first 72 bytes of a password (#735). */
describe("truncatePasswordToBcryptLimit (#735)", () => {
  it("keeps short passwords as-is", () => {
    expect(truncatePasswordToBcryptLimit("correct horse battery staple")).toBe(
      "correct horse battery staple",
    );
    expect(truncatePasswordToBcryptLimit("x".repeat(72))).toHaveLength(72);
  });

  it("cuts ASCII passwords at 72 bytes", () => {
    expect(truncatePasswordToBcryptLimit("x".repeat(80))).toBe("x".repeat(72));
  });

  it("cuts UTF-8 on character boundaries, not mid-code-point", () => {
    // 30 cups of tea = 90 bytes; 24 cups = 72 bytes exactly.
    expect(truncatePasswordToBcryptLimit("☕".repeat(30))).toBe("☕".repeat(24));
    // 19 emoji = 76 bytes; 18 emoji = 72 bytes exactly (no broken surrogate).
    expect(truncatePasswordToBcryptLimit("😀".repeat(19))).toBe("😀".repeat(18));
  });

  it("always returns the same bytes for equal byte input", () => {
    const password = "y".repeat(100);
    expect(new TextEncoder().encode(truncatePasswordToBcryptLimit(password)).length).toBe(
      BCRYPT_MAX_PASSWORD_BYTES,
    );
  });
});
