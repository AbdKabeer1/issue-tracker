import { describe, expect, it } from "vitest";
import { appCookieOptions, secureCookiesEnabled } from "./cookie-options";

describe("app cookie attributes (#514)", () => {
  it("are Secure in production", () => {
    expect(secureCookiesEnabled({ NODE_ENV: "production", AUTH_URL: "https://ziki.dev/api/auth" })).toBe(true);
    expect(secureCookiesEnabled({ NODE_ENV: "production" })).toBe(true);
  });

  it("stay usable over plain http in development and on a local production build", () => {
    expect(secureCookiesEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(secureCookiesEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(secureCookiesEnabled({ NODE_ENV: "production", NEXTAUTH_URL: "http://localhost:3000" })).toBe(false);
  });

  it("keep the existing attributes", () => {
    expect(appCookieOptions(60)).toMatchObject({ path: "/", maxAge: 60, sameSite: "lax", httpOnly: true });
  });
});
