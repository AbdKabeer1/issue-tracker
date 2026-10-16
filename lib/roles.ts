/** Matches Prisma `Role` enum — kept local so helpers stay edge-safe. */
export type AppRole = "user" | "admin" | "super_admin";

/** Alias used by assignee selectors and similar UI. */
export type UserRole = AppRole;

export const ROLES = {
  user: "user",
  admin: "admin",
  super_admin: "super_admin",
} as const satisfies Record<AppRole, AppRole>;

export const roleLabels: Record<AppRole, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super admin",
};

/** Admin or super_admin — can access admin-gated features. */
export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}

/** Plain-text label for `<option>` lists where badges cannot render. */
export function formatUserLabel(
  name: string,
  role?: AppRole | null,
): string {
  return isAdmin(role) ? `${name} (Admin)` : name;
}

export const ACTIVE_ROLE_COOKIE_NAME = "zedu_active_role";

export function resolveEffectiveRole({
  isRealSuperAdmin,
  baseRole,
  activeRoleOverride,
  currentUserId,
}: {
  isRealSuperAdmin: boolean;
  baseRole?: AppRole | null;
  activeRoleOverride?: string | null;
  currentUserId?: string | null;
}): AppRole {
  let overrideRole = activeRoleOverride;
  if (activeRoleOverride && activeRoleOverride.includes(":")) {
    const [rolePart, userIdPart] = activeRoleOverride.split(":");
    if (userIdPart && currentUserId && userIdPart !== currentUserId) {
      return baseRole ?? "user";
    }
    overrideRole = rolePart;
  }

  if (isRealSuperAdmin) {
    if (
      overrideRole === "user" ||
      overrideRole === "admin" ||
      overrideRole === "super_admin"
    ) {
      return overrideRole;
    }
  } else if (baseRole === "admin") {
    if (overrideRole === "user" || overrideRole === "admin") {
      return overrideRole;
    }
  }
  return baseRole ?? "user";
}


