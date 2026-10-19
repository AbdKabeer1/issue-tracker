import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ZEDU_SLUG } from "@/lib/tenant";
import { isSuperAdmin, type AppRole } from "@/lib/roles";

/**
 * Which tenant a person's agents live in, and who administers it (#427).
 *
 * Until issues are scoped to the session's tenant (#425), a person's agents go
 * in the tenant they belong to, preferring Zedu. Someone with no membership
 * (a signup after the platform migration, #423) can't register agents until
 * they create or join a tenant (#444).
 */

export type OwnerTenant = { tenantId: string; role: MembershipRole };

export async function tenantForOwner(userId: string): Promise<OwnerTenant | null> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { tenantId: true, role: true, tenant: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  const chosen = memberships.find((m) => m.tenant.slug === ZEDU_SLUG) ?? memberships[0];
  return chosen ? { tenantId: chosen.tenantId, role: chosen.role } : null;
}

/** Owners and admins of a tenant. The site's super admin counts everywhere. */
export function isTenantAdminRole(
  membershipRole: MembershipRole | null | undefined,
  appRole?: AppRole | null,
): boolean {
  return membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin(appRole);
}

export async function isTenantAdmin(
  user: { id: string; role?: AppRole | null },
  tenantId: string,
): Promise<boolean> {
  if (isSuperAdmin(user.role)) return true;
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    select: { role: true },
  });
  return isTenantAdminRole(membership?.role);
}
