import { afterEach, describe, expect, it } from "vitest";
import {
  appBaseUrl,
  buildPasswordResetUrl,
  createRawResetToken,
  hashResetToken,
} from "./password-reset";

const ORIGINAL_AUTH = process.env.AUTH_URL;
const ORIGINAL_NEXTAUTH = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = ORIGINAL_AUTH;
  if (ORIGINAL_NEXTAUTH === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH;
});

describe("password-reset helpers", () => {
  it("hashes tokens deterministically", () => {
    const token = "fixed-test-token";
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(token)).not.toBe(token);
  });

  it("creates unique raw tokens", () => {
    expect(createRawResetToken()).not.toBe(createRawResetToken());
  });

  it("builds a reset URL under the app base and strips /api/auth", () => {
    process.env.AUTH_URL =
      "https://contributors.zedu.chat/bug-tracker/api/auth";
    delete process.env.NEXTAUTH_URL;

    const url = buildPasswordResetUrl("tok123");
    expect(url).toBe(
      "https://contributors.zedu.chat/bug-tracker/reset-password?token=tok123",
    );
    expect(url).not.toContain("/api/auth");
    expect(appBaseUrl()).toBe("https://contributors.zedu.chat/bug-tracker");
  });

  it("handles NEXTAUTH_URL with trailing slash on /api/auth/", () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL =
      "https://contributors.zedu.chat/bug-tracker/api/auth/";

    const url = buildPasswordResetUrl("tok456");
    expect(url).toBe(
      "https://contributors.zedu.chat/bug-tracker/reset-password?token=tok456",
    );
    expect(url).not.toContain("/api/auth");
  });
});
