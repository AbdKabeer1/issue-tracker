import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cross-tenant issue links (#519).
 *
 * Issue pages are scoped to the active tenant. When a member follows a link
 * to an issue in another tenant they belong to, that scoping turns into a
 * dead end. This resolver names the owning tenant — but only for members of
 * it, so non-members keep the plain 404 and nothing is revealed.
 */

export type IssueTenantHint = { id: string; name: string; slug: string };

type Db = PrismaClient | Prisma.TransactionClient;

export async function issueTenantHintFor(
  db: Db,
  viewer: { userId: string; activeTenantId: string | null; issueId: string },
): Promise<IssueTenantHint | null> {
  try {
    const bug = await db.bug.findUnique({
      where: { id: viewer.issueId, isDeleted: false },
      select: { tenantId: true },
    });
    if (!bug || bug.tenantId === viewer.activeTenantId) return null;

    const membership = await db.membership.findFirst({
      where: { userId: viewer.userId, tenantId: bug.tenantId },
      select: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    return membership?.tenant ?? null;
  } catch (error) {
    // A schema-repair deployment may lack the relation; the page then keeps
    // its plain 404 instead of failing.
    console.error("[issues] tenant hint lookup failed", error);
    return null;
  }
}
