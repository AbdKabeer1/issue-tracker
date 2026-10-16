import { createHash, randomBytes } from "crypto";
import { getSiteUrl } from "./site-url";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createRawResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** App origin including basePath (`/bug-tracker`), stripping `/api/auth` if present. */
export function appBaseUrl() {
  return getSiteUrl();
}

export function buildPasswordResetUrl(rawToken: string) {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}
