import { createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";

/**
 * Webhook signing (#445).
 *
 * - Sign `timestamp + "." + rawBody` with HMAC-SHA256.
 * - Send X-Ziki-Timestamp, X-Ziki-Signature, X-Ziki-Delivery (the event id).
 * - Receivers should reject a timestamp older than 5 minutes.
 *
 * The signing secret is AES-256-GCM encrypted in `WebhookSubscription.signingSecretEncrypted`
 * so the server can reconstruct the HMAC; it is never hashed (unlike API keys).
 * The raw secret is returned once on subscription creation.
 */

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.WEBHOOK_SECRET_KEY;
  if (!raw) {
    throw new Error("WEBHOOK_SECRET_KEY environment variable is not set. " +
      "Set it to 32 random bytes encoded as a 64-character hex string.");
  }
  const key = Buffer.from(raw, "hex");
  if (!/^[a-fA-F0-9]{64}$/.test(raw) || key.length !== KEY_BYTES) {
    throw new Error(`WEBHOOK_SECRET_KEY must be ${KEY_BYTES * 2} hex characters (${KEY_BYTES} bytes).`);
  }
  return key;
}

/**
 * Encrypt the raw signing secret for storage.
 * Returns a hex string: `iv(24 hex) + tag(32 hex) + ciphertext(hex)`.
 */
export function encryptSigningSecret(rawSecret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const pt = Buffer.from(rawSecret, "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + tag.toString("hex") + ct.toString("hex");
}

/**
 * Decrypt a value produced by `encryptSigningSecret`.
 */
export function decryptSigningSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const ivHex = encrypted.slice(0, IV_BYTES * 2);
  const tagHex = encrypted.slice(IV_BYTES * 2, IV_BYTES * 2 + TAG_BYTES * 2);
  const ctHex = encrypted.slice(IV_BYTES * 2 + TAG_BYTES * 2);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// ---------------------------------------------------------------------------
// Raw secret generation
// ---------------------------------------------------------------------------

/** Generates a 32-byte URL-safe random signing secret shown once. */
export function generateSigningSecret(): string {
  return randomBytes(32).toString("base64url");
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Compute the signature that goes in X-Ziki-Signature.
 *
 * Signed payload: `timestamp + "." + rawBody`
 * Algorithm: HMAC-SHA256, hex-encoded.
 */
export function sign(params: {
  rawSecret: string;
  timestampMs: number;
  rawBody: string;
}): string {
  const message = `${params.timestampMs}.${params.rawBody}`;
  return createHmac("sha256", params.rawSecret).update(message).digest("hex");
}

/**
 * Verify a signature. Returns false when the timestamp is older than
 * `toleranceMs` (default 5 minutes) so replays are rejected.
 */
export function verify(params: {
  rawSecret: string;
  signature: string;
  timestampMs: number;
  rawBody: string;
  toleranceMs?: number;
  now?: number;
}): boolean {
  const now = params.now ?? Date.now();
  if (!Number.isFinite(params.timestampMs) || !/^[a-f0-9]{64}$/.test(params.signature)) return false;
  const tolerance = params.toleranceMs ?? 5 * 60 * 1000;
  if (Math.abs(now - params.timestampMs) > tolerance) return false;
  const expected = sign({
    rawSecret: params.rawSecret,
    timestampMs: params.timestampMs,
    rawBody: params.rawBody,
  });
  // Constant-time comparison.
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(params.signature, "hex"));
}
