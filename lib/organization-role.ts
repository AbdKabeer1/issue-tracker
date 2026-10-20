import { isSuperAdmin, type AppRole } from "@/lib/roles";

/** A person's role inside one organization. Matches Prisma `MembershipRole`. */
export type OrganizationRole = "owner" | "admin" | "member";

/**
 * Admin powers inside one organization.
 *
 * An owner or admin of that organization has them. The site's super admin
 * does too. A site-wide `admin` does not: that title must not follow someone
 * into an organization where they are only a member.
 */
export function isOrganizationAdmin(
  membershipRole: OrganizationRole | null | undefined,
  appRole?: AppRole | null,
): boolean {
  return membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin(appRole);
}
