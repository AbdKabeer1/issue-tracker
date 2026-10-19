import { isAdmin, isSuperAdmin, type AppRole } from "@/lib/roles";

export type HeaderNavItem = { href: string; label: string };

/** Links shown in the header for the role the user is currently viewing as. */
export function headerNavItems(role?: AppRole | null): HeaderNavItem[] {
  const items: HeaderNavItem[] = [
    { href: "/issues", label: "Issues" },
    // #426: projects decide which issues the board shows.
    { href: "/projects", label: "Projects" },
    // #289: everyone can see what's left for a release.
    { href: "/milestones", label: "Milestones" },
  ];
  if (isAdmin(role)) {
    items.push(
      { href: "/admin/categories", label: "Platforms" },
      { href: "/admin/types", label: "Types" },
    );
  }
  if (isSuperAdmin(role)) {
    items.push({ href: "/admin/users", label: "Admins" });
  }
  return items;
}

/**
 * Whether a header link is the current page. "Issues" covers the list and
 * individual issues, but not the "New issue" form, which has its own button.
 */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (href === "/issues" || href === "/bugs") {
    return (
      path === "/issues" ||
      path === "/bugs" ||
      ((path.startsWith("/issues/") || path.startsWith("/bugs/")) &&
        path !== "/issues/new" &&
        path !== "/bugs/new")
    );
  }
  return path === href || path.startsWith(`${href}/`);
}

/** The role a user really has, before any "View as" override. */
export function realRoleOf(flags: {
  isRealSuperAdmin?: boolean;
  isRealAdmin?: boolean;
}): AppRole {
  if (flags.isRealSuperAdmin) return "super_admin";
  if (flags.isRealAdmin) return "admin";
  return "user";
}

export const roleViewLabels: Record<AppRole, string> = {
  super_admin: "Super admin",
  admin: "Team lead (admin)",
  user: "Normal user",
};

/** Up to two initials for the account button, e.g. "Bob Builder" → "BB". */
export function initialsOf(name?: string | null): string {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  const base = clean.includes("@") ? clean.split("@")[0] : clean;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}
