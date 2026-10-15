import { describe, expect, it } from "vitest";
import {
  buildPasswordResetUrl,
  createRawResetToken,
  hashResetToken,
} from "./password-reset";

describe("password-reset helpers", () => {
  it("hashes tokens deterministically", () => {
    const token = "fixed-test-token";
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(token)).not.toBe(token);
  });

  it("creates unique raw tokens", () => {
    expect(createRawResetToken()).not.toBe(createRawResetToken());
  });

  it("builds a reset URL under the app base", () => {
    const url = buildPasswordResetUrl("tok123");
    expect(url).toContain("/reset-password?token=tok123");
  });
});
