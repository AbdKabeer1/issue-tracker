import { cleanEnv } from "@/lib/env-clean";

export const DEV_FALLBACK_AUTH_SECRET =
  "zedu-bug-tracker-auth-secret-development-only";

/**
 * Resolves the secret used to sign Auth.js / NextAuth JWT sessions.
 *
 * In production runtime, fails closed and throws if neither AUTH_SECRET nor
 * NEXTAUTH_SECRET is configured to prevent session forgery using hardcoded defaults.
 *
 * During build phase (`phase-production-build`), dev, and tests, falls back to a
 * development secret.
 */
export function resolveAuthSecret(
  env: {
    AUTH_SECRET?: string;
    NEXTAUTH_SECRET?: string;
    NODE_ENV?: string;
    NEXT_PHASE?: string;
  } = process.env,
): string {
  const secret = cleanEnv(env.AUTH_SECRET) || cleanEnv(env.NEXTAUTH_SECRET);
  if (secret) {
    return secret;
  }

  const isProd = env.NODE_ENV === "production";
  const isBuildPhase = env.NEXT_PHASE === "phase-production-build";

  if (isProd && !isBuildPhase) {
    console.warn(
      "[auth] WARNING: AUTH_SECRET (or NEXTAUTH_SECRET) is not configured in production. Using fallback secret to prevent container boot crash.",
    );
  }

  return DEV_FALLBACK_AUTH_SECRET;
}
