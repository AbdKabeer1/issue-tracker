import { createHash, randomBytes } from "crypto";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createRawResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** App origin including basePath (`/bug-tracker`). */
export function appBaseUrl() {
  const raw =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3001/bug-tracker";
  return raw.replace(/\/$/, "");
}

export function buildPasswordResetUrl(rawToken: string) {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}
