import { describe, expect, it, vi } from "vitest";

vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

import { isGoogleOAuthConfigured } from "./google-oauth";

describe("isGoogleOAuthConfigured", () => {
  it("returns true when both client ID and secret are set", () => {
    expect(isGoogleOAuthConfigured()).toBe(true);
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