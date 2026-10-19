import { cache } from "react";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeProjectIdFor } from "@/lib/project-context";
import { ZEDU_SLUG } from "@/lib/tenant";

/**
 * The tenant every read and write of issues, comments and notifications is
 * scoped to (#425).
 *
 * The tenant comes from the person's membership, never from merely having a
 * session. Existing users are members of Zedu (#423), so they land there. A
 * new account has no membership, gets `null`, and sees no issues at all until
 * they create or join a tenant (#444).
 */

type Db = PrismaClient | Prisma.TransactionClient;

type MembershipChoice = { tenantId: string; tenant: { slug: string } };

/**
 * Picks the tenant to show from someone's memberships: Zedu if they belong to
 * it, otherwise their oldest membership. The switcher (#426, #444) will
 * replace this choice; the "no membership, no tenant" rule stays.
 */
export function pickTenantId(memberships: ReadonlyArray<MembershipChoice>): string | null {
  const zedu = memberships.find((m) => m.tenant.slug === ZEDU_SLUG);
  return (zedu ?? memberships[0])?.tenantId ?? null;
}

export async function tenantIdForUser(db: Db, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const memberships = await db.membership.findMany({
    where: { userId },
    select: { tenantId: true, tenant: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return pickTenantId(memberships);
}

/** `tenantIdForUser`, looked up once per request. */
export const currentTenantIdFor = cache((userId: string | null | undefined) =>
  tenantIdForUser(prisma, userId),
);

/**
 * The project new issues go into: the active project (#426), else the tenant's
 * Zedu project, else its oldest.
 */
export async function defaultProjectIdFor(db: Db, tenantId: string): Promise<string | null> {
  return activeProjectIdFor(db, tenantId);
}

/**
 * The tenant part of a `where`. Only `tenantId`, so it can be spread into a
 * `findUnique({ where: { id } })` as well as a list filter.
 */
export type TenantScope = { tenantId: string | { in: string[] } };

/** Matches nothing: what someone with no tenant is allowed to see. */
const NO_TENANT: TenantScope = { tenantId: { in: [] } };

/** Issues in `tenantId`. With no tenant, no issues. */
export function bugInTenant(tenantId: string | null): TenantScope {
  return tenantId ? { tenantId } : NO_TENANT;
}

/** Comments on issues in `tenantId`. */
export function commentInTenant(tenantId: string | null): { bug: TenantScope } {
  return { bug: bugInTenant(tenantId) };
}

/**
 * Notifications about issues in `tenantId`. Notifications that aren't about
 * an issue (e.g. account changes) belong to the person, so they stay visible.
 */
export function notificationInTenant(tenantId: string | null): Prisma.NotificationWhereInput {
  return tenantId ? { OR: [{ bugId: null }, { bug: { tenantId } }] } : { bugId: null };
}

/** Shown when someone without a tenant tries to file an issue. */
export const NO_TENANT_MESSAGE =
  "You're not a member of a workspace yet, so you can't file issues here.";
