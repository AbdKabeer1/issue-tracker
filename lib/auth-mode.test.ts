import { describe, expect, it } from "vitest";
import { isPasswordAuthEnabled } from "./auth-mode";

describe("isPasswordAuthEnabled", () => {
  it("is off in production by default", () => {
    expect(isPasswordAuthEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("is on in development and test by default", () => {
    expect(isPasswordAuthEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isPasswordAuthEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isPasswordAuthEnabled({})).toBe(true);
  });

  it("can be explicitly enabled in production", () => {
    expect(
      isPasswordAuthEnabled({ NODE_ENV: "production", AUTH_PASSWORD_LOGIN: "true" }),
    ).toBe(true);
  });

  it("can be explicitly disabled in development", () => {
    expect(
      isPasswordAuthEnabled({ NODE_ENV: "development", AUTH_PASSWORD_LOGIN: "false" }),
    ).toBe(false);
  });

  it("tolerates quoted, padded and mixed-case values from deploy UIs", () => {
    expect(
      isPasswordAuthEnabled({ NODE_ENV: "production", AUTH_PASSWORD_LOGIN: ' "TRUE" ' }),
    ).toBe(true);
    expect(
      isPasswordAuthEnabled({ NODE_ENV: "development", AUTH_PASSWORD_LOGIN: "0" }),
    ).toBe(false);
  });

  it("ignores unrecognised values and falls back to the environment default", () => {
    expect(
      isPasswordAuthEnabled({ NODE_ENV: "production", AUTH_PASSWORD_LOGIN: "yes" }),
    ).toBe(false);
  });
});
