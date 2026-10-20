import { describe, expect, it, vi } from "vitest";

vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

import { isGoogleOAuthConfigured } from "./google-oauth";

describe("isGoogleOAuthConfigured", () => {
  it("returns true when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set", () => {
    expect(isGoogleOAuthConfigured()).toBe(true);
  });

  it("returns true when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set (fallback)", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("AUTH_GOOGLE_ID", "test-auth-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-auth-secret");
    expect(isGoogleOAuthConfigured()).toBe(true);
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    vi.unstubAllEnvs();
  });

  it("returns false when client ID is missing", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(isGoogleOAuthConfigured()).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  });

  it("returns false when client secret is missing", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(isGoogleOAuthConfigured()).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  });

  it("returns false when both are missing", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(isGoogleOAuthConfigured()).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  });
});