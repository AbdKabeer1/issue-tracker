import { describe, expect, it } from "vitest";

// Mock WEBHOOK_SECRET_KEY before importing sign.
process.env.WEBHOOK_SECRET_KEY = "0".repeat(64); // 32 bytes of zeros as hex

import { sign, verify, encryptSigningSecret, decryptSigningSecret, generateSigningSecret } from "./sign";

describe("webhook signing", () => {
  const secret = "test-signing-secret-abc123";
  const body = JSON.stringify({ id: "evt-1", type: "issue.created" });
  const timestampMs = 1729350000000;

  it("produces a deterministic HMAC-SHA256 hex signature", () => {
    const sig1 = sign({ rawSecret: secret, timestampMs, rawBody: body });
    const sig2 = sign({ rawSecret: secret, timestampMs, rawBody: body });
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
  });

  it("includes the timestamp in the signed payload (different timestamps → different sigs)", () => {
    const sig1 = sign({ rawSecret: secret, timestampMs, rawBody: body });
    const sig2 = sign({ rawSecret: secret, timestampMs: timestampMs + 1, rawBody: body });
    expect(sig1).not.toBe(sig2);
  });

  it("includes the body in the signed payload", () => {
    const sig1 = sign({ rawSecret: secret, timestampMs, rawBody: body });
    const sig2 = sign({ rawSecret: secret, timestampMs, rawBody: body + " " });
    expect(sig1).not.toBe(sig2);
  });

  describe("verify", () => {
    it("returns true for a valid signature within the tolerance window", () => {
      const sig = sign({ rawSecret: secret, timestampMs, rawBody: body });
      expect(verify({ rawSecret: secret, signature: sig, timestampMs, rawBody: body, now: timestampMs })).toBe(true);
    });

    it("returns false for a tampered signature", () => {
      const sig = sign({ rawSecret: secret, timestampMs, rawBody: body });
      const tampered = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
      expect(verify({ rawSecret: secret, signature: tampered, timestampMs, rawBody: body, now: timestampMs })).toBe(false);
    });

    it("rejects a non-finite timestamp", () => {
      const signature = sign({ rawSecret: secret, timestampMs: NaN, rawBody: body });
      expect(verify({ rawSecret: secret, signature, timestampMs: NaN, rawBody: body })).toBe(false);
    });

    it("rejects a timestamp older than the tolerance (5 minutes by default)", () => {
      const oldMs = timestampMs - 6 * 60 * 1000; // 6 minutes ago
      const sig = sign({ rawSecret: secret, timestampMs: oldMs, rawBody: body });
      expect(verify({ rawSecret: secret, signature: sig, timestampMs: oldMs, rawBody: body, now: timestampMs })).toBe(false);
    });

    it("accepts a timestamp exactly at the edge of the tolerance", () => {
      const edgeMs = timestampMs - 5 * 60 * 1000;
      const sig = sign({ rawSecret: secret, timestampMs: edgeMs, rawBody: body });
      // At exactly 5 minutes, Math.abs(now - ts) === tolerance, so it should still pass.
      expect(verify({ rawSecret: secret, signature: sig, timestampMs: edgeMs, rawBody: body, now: timestampMs })).toBe(true);
    });
  });
});

describe("signing secret encryption", () => {
  it("round-trips a secret via encrypt/decrypt", () => {
    const raw = generateSigningSecret();
    const encrypted = encryptSigningSecret(raw);
    expect(decryptSigningSecret(encrypted)).toBe(raw);
  });

  it("generateSigningSecret produces a non-empty URL-safe string", () => {
    const s = generateSigningSecret();
    expect(s.length).toBeGreaterThan(0);
    expect(s).toMatch(/^[\w-]+$/); // base64url alphabet
  });

  it("two secrets are not equal", () => {
    expect(generateSigningSecret()).not.toBe(generateSigningSecret());
  });

  it("authenticates encrypted secrets and rejects tampering", () => {
    const value = encryptSigningSecret("secret");
    const tampered = (value.startsWith("0") ? "1" : "0") + value.slice(1);
    expect(() => decryptSigningSecret(tampered)).toThrow();
  });
});
