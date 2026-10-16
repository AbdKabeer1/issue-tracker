import { cleanEnv } from "@/lib/env-clean";

export const DEFAULT_SUPER_ADMIN_EMAILS = [
  "amicablembakara50@gmail.com",
] as const;

export function getSuperAdminEmails(): Set<string> {
  const raw =
    cleanEnv(process.env.SUPER_ADMIN_EMAIL) ||
    cleanEnv(process.env.SUPER_ADMIN_EMAILS) ||
    "";

  const configured = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return new Set([
    ...DEFAULT_SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...configured,
  ]);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  return getSuperAdminEmails().has(email.trim().toLowerCase());
}
