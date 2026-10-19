import { cleanEnv } from "@/lib/env-clean";
import { isSuperAdminEmail } from "@/lib/super-admin";

type GoogleAllowlistEnv = {
  GOOGLE_ALLOWED_EMAILS?: string;
  GOOGLE_ALLOWED_DOMAINS?: string;
  SUPER_ADMIN_EMAIL?: string;
  SUPER_ADMIN_EMAILS?: string;
};

export type GoogleAllowlist = {
  emails: Set<string>;
  domains: Set<string>;
  configured: boolean;
};

/**
 * Parse `GOOGLE_ALLOWED_EMAILS` and `GOOGLE_ALLOWED_DOMAINS` into a lookup
 * set. Both may hold comma-separated values; email matching is
 * case-insensitive and domain matching ignores a leading `@`.
 *
 * `configured` is false when neither variable holds any value — a deployment
 * in that state allows every Google address (the historic behaviour) and
 * should log a warning at sign-in time (#223).
 */
export function getGoogleAllowlist(
  env: GoogleAllowlistEnv = process.env as GoogleAllowlistEnv,
): GoogleAllowlist {
  const rawEmails = cleanEnv(env.GOOGLE_ALLOWED_EMAILS) ?? "";
  const rawDomains = cleanEnv(env.GOOGLE_ALLOWED_DOMAINS) ?? "";

  const emails = new Set(
    rawEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

  const domains = new Set(
    rawDomains
      .split(",")
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
  );

  return { emails, domains, configured: emails.size > 0 || domains.size > 0 };
}

/**
 * Decide whether a Google identity may be auto-provisioned (#223).
 *
 * - Super-admin emails always pass so an operator locked out by a too-strict
 *   allowlist can still get in.
 * - When neither `GOOGLE_ALLOWED_EMAILS` nor `GOOGLE_ALLOWED_DOMAINS` is set
 *   every address passes (backwards compatible with existing deployments).
 * - Otherwise the address must match an exact email or a listed domain.
 */
export function isGoogleEmailAllowed(
  email?: string | null,
  env?: GoogleAllowlistEnv,
): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();

  if (isSuperAdminEmail(normalized, env)) return true;

  const { emails, domains, configured } = getGoogleAllowlist(env);
  if (!configured) return true;
  if (emails.has(normalized)) return true;

  const at = normalized.lastIndexOf("@");
  if (at === -1) return false;
  return domains.has(normalized.slice(at + 1));
}
