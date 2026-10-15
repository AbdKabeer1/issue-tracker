import type { Role } from "@prisma/client";

/** Why a role change was refused, or null when it is allowed. */
export type RoleChangeRefusal =
  | "self"
  | "not-found"
  | "super-admin"
  | "already-admin"
  | "already-user"
  | null;

/**
 * Guards for the role changes a super admin can make.
 *
 * Promotion and demotion share the same hazards: a super admin must not be
 * able to edit their own role, and must not be able to edit another super
 * admin — otherwise the last super admin can be stripped and nobody can
 * restore access. Kept pure so both server actions and Vitest can use it.
 */
export function refuseRoleChange(
  actorId: string,
  target: { id: string; role: Role } | null,
  nextRole: Role,
): RoleChangeRefusal {
  if (!target) return "not-found";
  if (target.id === actorId) return "self";
  if (target.role === "super_admin") return "super-admin";
  if (nextRole === "admin" && target.role === "admin") return "already-admin";
  if (nextRole === "user" && target.role === "user") return "already-user";
  return null;
}

export const ROLE_CHANGE_ERRORS: Record<
  Exclude<RoleChangeRefusal, null>,
  string
> = {
  self: "You cannot change your own role here",
  "not-found": "User not found",
  "super-admin": "Cannot change a super admin's role",
  "already-admin": "User is already an admin",
  "already-user": "User is already a regular user",
};