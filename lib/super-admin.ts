import { cleanEnv } from "@/lib/env-clean";

type SuperAdminEnv = {
  SUPER_ADMIN_EMAIL?: string;
  SUPER_ADMIN_EMAILS?: string;
};

/**
 * Email addresses that are always granted the super_admin role, read only from
 * the environment (#111). Nothing is hard-coded: a deployment with neither
 * variable set has no auto-provisioned super admin, and existing super admins
 * keep the role stored on their User row.
 *
 * Both variables are read and merged, and each may hold a comma-separated list.
 */
export function getSuperAdminEmails(
  env: SuperAdminEnv = process.env as SuperAdminEnv,
): Set<string> {
  const raw = [cleanEnv(env.SUPER_ADMIN_EMAIL), cleanEnv(env.SUPER_ADMIN_EMAILS)]
    .filter(Boolean)
    .join(",");

  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdminEmail(
  email?: string | null,
  env?: SuperAdminEnv,
): boolean {
  if (!email || typeof email !== "string") return false;
  return getSuperAdminEmails(env).has(email.trim().toLowerCase());
}
