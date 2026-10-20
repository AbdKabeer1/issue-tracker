import { afterEach, describe, expect, it, vi } from "vitest";
import { isSensitiveKey, logger, safeJsonStringify, sanitize, sanitizeString } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isSensitiveKey", () => {
    it("identifies sensitive keys", () => {
      expect(isSensitiveKey("password")).toBe(true);
      expect(isSensitiveKey("passwordHash")).toBe(true);
      expect(isSensitiveKey("secret")).toBe(true);
      expect(isSensitiveKey("apiKey")).toBe(true);
      expect(isSensitiveKey("rawToken")).toBe(true);
      expect(isSensitiveKey("sessionToken")).toBe(true);
      expect(isSensitiveKey("authorization")).toBe(true);
      expect(isSensitiveKey("cookie")).toBe(true);
      expect(isSensitiveKey("key")).toBe(true);
      expect(isSensitiveKey("user_code")).toBe(true);
    });

    it("identifies non-sensitive keys", () => {
      expect(isSensitiveKey("id")).toBe(false);
      expect(isSensitiveKey("name")).toBe(false);
      expect(isSensitiveKey("email")).toBe(false);
      expect(isSensitiveKey("status")).toBe(false);
      expect(isSensitiveKey("title")).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("redacts Bearer tokens", () => {
      expect(sanitizeString("Authorization: Bearer super-secret-token-123")).toBe(
        "Authorization: Bearer [REDACTED]",
      );
    });

    it("redacts Basic auth credentials", () => {
      expect(sanitizeString("Authorization: Basic dXNlcjpwYXNz")).toBe(
        "Authorization: Basic [REDACTED]",
      );
    });

    it("redacts database credentials in URLs", () => {
      expect(
        sanitizeString("Failed to connect to postgresql://postgres:mysecretpass@localhost:5432/mydb"),
      ).toBe("Failed to connect to postgresql://postgres:[REDACTED]@localhost:5432/mydb");
    });

    it("redacts URL query parameters", () => {
      expect(
        sanitizeString("Redirected to https://example.com/login?token=abc123xyz&ref=home"),
      ).toBe("Redirected to https://example.com/login?token=[REDACTED]&ref=home");
    });

    it("redacts Ziki agent keys", () => {
      expect(sanitizeString("Agent key: zek_live_1234567890abcdef")).toBe(
        "Agent key: zek_[REDACTED]",
      );
    });

    it("redacts JWT tokens", () => {
      const sampleJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP8pY2w6E";
      expect(sanitizeString(`Session: ${sampleJwt}`)).toBe("Session: [JWT_REDACTED]");
    });
  });

  describe("sanitize", () => {
    it("redacts sensitive fields in objects", () => {
      const input = {
        userId: "user-1",
        email: "alice@example.com",
        password: "secretpassword",
        apiKey: "zek_1234567890",
        nested: {
          token: "secret-token",
          info: "public",
        },
      };

      const result = sanitize(input);
      expect(result).toEqual({
        userId: "user-1",
        email: "alice@example.com",
        password: "[REDACTED]",
        apiKey: "[REDACTED]",
        nested: {
          token: "[REDACTED]",
          info: "public",
        },
      });
    });

    it("sanitizes Error objects including messages and causes", () => {
      const err = new Error("Failed connecting to postgres://user:secret@localhost:5432/db");
      (err as unknown as Record<string, unknown>).apiKey = "secret-key";

      const sanitized = sanitize(err) as Error & { apiKey: string };
      expect(sanitized.message).toBe("Failed connecting to postgres://user:[REDACTED]@localhost:5432/db");
      expect(sanitized.apiKey).toBe("[REDACTED]");
    });

    it("handles circular references gracefully", () => {
      const obj: Record<string, unknown> = { name: "test" };
      obj.self = obj;

      const sanitized = sanitize(obj) as Record<string, unknown>;
      expect(sanitized.name).toBe("test");
      expect(sanitized.self).toBe("[Circular]");
    });
  });

  describe("safeJsonStringify", () => {
    it("serializes without leaking secrets", () => {
      const json = safeJsonStringify({
        user: "alice",
        password: "secretpassword",
      });
      expect(json).toBe('{"user":"alice","password":"[REDACTED]"}');
    });
  });

  describe("logger methods", () => {
    it("calls console.error with sanitized arguments", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      logger.error("[auth] login failed", {
        email: "test@example.com",
        password: "my-password",
      });

      expect(spy).toHaveBeenCalledWith("[auth] login failed", {
        email: "test@example.com",
        password: "[REDACTED]",
      });
    });

    it("calls console.warn with sanitized arguments", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.warn("Warning with token:", "Bearer secret-token-value");

      expect(spy).toHaveBeenCalledWith("Warning with token:", "Bearer [REDACTED]");
    });
  });
});
