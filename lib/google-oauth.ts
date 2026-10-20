import { cleanEnv } from "@/lib/env-clean";

/**
 * Whether Google OAuth is configured.
 * This is edge-safe (no Prisma / bcrypt) so it can be used in middleware and client components.
 */
export function isGoogleOAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const clientId = cleanEnv(env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(env.GOOGLE_CLIENT_SECRET);
  return Boolean(clientId && clientSecret);
}