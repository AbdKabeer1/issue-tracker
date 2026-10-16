import { describe, expect, it } from "vitest";
import {
  DEV_FALLBACK_AUTH_SECRET,
  resolveAuthSecret,
} from "./auth-secret";

describe("resolveAuthSecret", () => {
  it("returns AUTH_SECRET when present", () => {
    const secret = resolveAuthSecret({
      AUTH_SECRET: "my-custom-auth-secret",
      NODE_ENV: "production",
    });
    expect(secret).toBe("my-custom-auth-secret");
  });

  it("returns NEXTAUTH_SECRET when AUTH_SECRET is omitted", () => {
    const secret = resolveAuthSecret({
      NEXTAUTH_SECRET: "my-nextauth-secret",
      NODE_ENV: "production",
    });
    expect(secret).toBe("my-nextauth-secret");
  });

  it("sanitizes quotes and whitespace from the secret", () => {
    const secret = resolveAuthSecret({
      AUTH_SECRET: '  "quoted-secret-123"  ',
      NODE_ENV: "production",
    });
    expect(secret).toBe("quoted-secret-123");
  });

  it("throws in production when no secret is configured", () => {
    expect(() =>
      resolveAuthSecret({
        NODE_ENV: "production",
      }),
    ).toThrowError(/Missing AUTH_SECRET \(or NEXTAUTH_SECRET\)/);
  });

  it("throws in production when secret is blank or empty quotes", () => {
    expect(() =>
      resolveAuthSecret({
        AUTH_SECRET: '  ""  ',
        NODE_ENV: "production",
      }),
    ).toThrowError(/Missing AUTH_SECRET \(or NEXTAUTH_SECRET\)/);
  });

  it("returns dev fallback in development or test when no secret is configured", () => {
    expect(resolveAuthSecret({ NODE_ENV: "development" })).toBe(
      DEV_FALLBACK_AUTH_SECRET,
    );
    expect(resolveAuthSecret({ NODE_ENV: "test" })).toBe(
      DEV_FALLBACK_AUTH_SECRET,
    );
  });

  it("allows production build phase to succeed with fallback when secret is omitted", () => {
    const secret = resolveAuthSecret({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    expect(secret).toBe(DEV_FALLBACK_AUTH_SECRET);
  });
});
