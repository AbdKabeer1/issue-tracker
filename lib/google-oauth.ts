import { cleanEnv } from "@/lib/env-clean";

/**
 * Whether Google OAuth is configured.
 * This is edge-safe (no Prisma / bcrypt) so it can be used in middleware and client components.
 * Matches the fallback credential selection in auth.ts (GOOGLE_CLIENT_ID || AUTH_GOOGLE_ID).
 */
export function isGoogleOAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const clientId = cleanEnv(env.GOOGLE_CLIENT_ID || env.AUTH_GOOGLE_ID);
  const clientSecret = cleanEnv(env.GOOGLE_CLIENT_SECRET || env.AUTH_GOOGLE_SECRET);
  return Boolean(clientId && clientSecret);
}