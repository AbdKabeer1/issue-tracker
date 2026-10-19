import { describe, expect, it } from "vitest";
import { getGoogleAllowlist, isGoogleEmailAllowed } from "./google-allowlist";

describe("getGoogleAllowlist", () => {
  it("is not configured when neither variable is set", () => {
    const list = getGoogleAllowlist({});
    expect(list.configured).toBe(false);
    expect(list.emails.size).toBe(0);
    expect(list.domains.size).toBe(0);
  });

  it("is not configured when the variables hold only blank/quoted-blank values", () => {
    expect(getGoogleAllowlist({ GOOGLE_ALLOWED_EMAILS: '""' }).configured).toBe(false);
    expect(getGoogleAllowlist({ GOOGLE_ALLOWED_DOMAINS: "  " }).configured).toBe(false);
  });

  it("parses comma-separated emails case-insensitively", () => {
    const list = getGoogleAllowlist({
      GOOGLE_ALLOWED_EMAILS: '"Alice@Example.com, bob@example.com"',
    });
    expect(list.configured).toBe(true);
    expect([...list.emails]).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("parses domains and strips a leading @", () => {
    const list = getGoogleAllowlist({
      GOOGLE_ALLOWED_DOMAINS: "@zedu.chat, example.org",
    });
    expect([...list.domains]).toEqual(["zedu.chat", "example.org"]);
  });

  it("is configured when only one of the two variables is set", () => {
    expect(getGoogleAllowlist({ GOOGLE_ALLOWED_EMAILS: "a@b.co" }).configured).toBe(true);
    expect(getGoogleAllowlist({ GOOGLE_ALLOWED_DOMAINS: "b.co" }).configured).toBe(true);
  });
});

describe("isGoogleEmailAllowed (#223)", () => {
  it("allows every address when no allowlist is configured (historic behaviour)", () => {
    expect(isGoogleEmailAllowed("anything@gmail.com", {})).toBe(true);
    expect(isGoogleEmailAllowed("spammer@random.net", {})).toBe(true);
  });

  it("rejects a missing email regardless of configuration", () => {
    expect(isGoogleEmailAllowed(null, {})).toBe(false);
    expect(isGoogleEmailAllowed(undefined, {})).toBe(false);
    expect(isGoogleEmailAllowed("", {})).toBe(false);
    expect(isGoogleEmailAllowed(null, { GOOGLE_ALLOWED_EMAILS: "a@b.co" })).toBe(false);
  });

  it("rejects a malformed address when an allowlist is configured", () => {
    expect(isGoogleEmailAllowed("not-an-email", { GOOGLE_ALLOWED_EMAILS: "a@b.co" })).toBe(false);
  });

  it("admits exact allowlisted emails, case- and whitespace-insensitively", () => {
    const env = { GOOGLE_ALLOWED_EMAILS: "Alice@Example.com" };
    expect(isGoogleEmailAllowed("alice@example.com", env)).toBe(true);
    expect(isGoogleEmailAllowed(" ALICE@EXAMPLE.COM ", env)).toBe(true);
    expect(isGoogleEmailAllowed("mallory@example.com", env)).toBe(false);
  });

  it("admits any address on an allowlisted domain", () => {
    const env = { GOOGLE_ALLOWED_DOMAINS: "zedu.chat" };
    expect(isGoogleEmailAllowed("dev@zedu.chat", env)).toBe(true);
    expect(isGoogleEmailAllowed("anyone@zedu.chat", env)).toBe(true);
    expect(isGoogleEmailAllowed("dev@evil.example", env)).toBe(false);
  });

  it("admits when either list matches", () => {
    const env = {
      GOOGLE_ALLOWED_EMAILS: "friend@gmail.com",
      GOOGLE_ALLOWED_DOMAINS: "zedu.chat",
    };
    expect(isGoogleEmailAllowed("friend@gmail.com", env)).toBe(true);
    expect(isGoogleEmailAllowed("dev@zedu.chat", env)).toBe(true);
    expect(isGoogleEmailAllowed("stranger@gmail.com", env)).toBe(false);
  });

  it("does not let a suffix-spoofed domain pass", () => {
    const env = { GOOGLE_ALLOWED_DOMAINS: "zedu.chat" };
    expect(isGoogleEmailAllowed("dev@notzedu.chat", env)).toBe(false);
    expect(isGoogleEmailAllowed("dev@zedu.chat.evil.com", env)).toBe(false);
  });

  it("always admits a super-admin address even when it is not allowlisted", () => {
    const env = {
      GOOGLE_ALLOWED_DOMAINS: "zedu.chat",
      SUPER_ADMIN_EMAIL: "owner@gmail.com",
    };
    expect(isGoogleEmailAllowed("owner@gmail.com", env)).toBe(true);
  });
});
