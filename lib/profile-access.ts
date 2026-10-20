import type { Prisma, PrismaClient } from "@prisma/client";
import { isSuperAdmin, type AppRole } from "@/lib/roles";

type Db = Pick<PrismaClient, "membership"> | Pick<Prisma.TransactionClient, "membership">;

/**
 * Whether `viewer` may open `personId`'s profile (#503).
 *
 * A profile shows someone's name, site role, join date, points and issues,
 * so it is visible to people who share at least one tenant with them, to
 * the person themselves and to the site's super admin. Everyone else gets
 * a 404, the same as an id that doesn't exist, so the page can't be used to
 * check whether an account exists.
 */
export async function canViewProfile(
  db: Db,
  viewer: { id: string; role?: AppRole | null },
  personId: string,
): Promise<boolean> {
  if (viewer.id === personId) return true;
  if (isSuperAdmin(viewer.role)) return true;
  const shared = await db.membership.findFirst({
    where: { userId: personId, tenant: { memberships: { some: { userId: viewer.id } } } },
    select: { id: true },
  });
  return shared !== null;
}
