import type { Prisma, PrismaClient, TenantJoinRequestStatus } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const TENANT_DESCRIPTION_MAX = 500;
export const TENANT_JOIN_REQUEST_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

export type TenantJoinRequestResult =
  | { ok: true; requestId: string; tenantId: string; tenantName: string; slug: string; created: boolean }
  | { ok: false; error: string };

/** Public workspace details are returned only for opted-in tenants. */
export async function discoverableTenants(db: Db, userId: string) {
  return db.tenant.findMany({
    where: { discoverable: true, memberships: { none: { userId } } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      memberships: {
        where: { role: "owner" },
        take: 1,
        select: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      joinRequests: {
        where: { userId },
        select: { status: true, requestedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function requestsForUser(db: Db, userId: string) {
  return db.tenantJoinRequest.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      tenant: { select: { id: true, name: true, slug: true, discoverable: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
}

export async function pendingTenantJoinRequests(db: Db, tenantId: string) {
  return db.tenantJoinRequest.findMany({
    where: { tenantId, status: "pending" },
    select: {
      id: true,
      requestedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
}

/** Creates or reopens the unique request for this person and workspace. */
export async function requestTenantMembership(
  db: Db,
  userId: string,
  tenantId: string,
  now = new Date(),
): Promise<TenantJoinRequestResult> {
  if (!tenantId) return { ok: false, error: "Choose a workspace." };
  if (await db.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { id: true } })) {
    return { ok: false, error: "You already belong to this workspace." };
  }

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, discoverable: true },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) return { ok: false, error: "This workspace is not accepting join requests." };

  const existing = await db.tenantJoinRequest.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "pending") {
    return { ok: true, requestId: existing.id, tenantId: tenant.id, tenantName: tenant.name, slug: tenant.slug, created: false };
  }

  let request: { id: string };
  try {
    request = existing
      ? await db.tenantJoinRequest.update({
          where: { id: existing.id },
          data: { status: "pending", requestedAt: now, reviewedAt: null, reviewedById: null },
          select: { id: true },
        })
      : await db.tenantJoinRequest.create({
          data: { tenantId, userId, requestedAt: now },
          select: { id: true },
        });
  } catch (error) {
    // Two simultaneous requests may both observe no row. The unique key makes
    // the losing insert harmless; read back the winner as the pending result.
    const duplicate = await db.tenantJoinRequest.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { id: true, status: true },
    });
    if (duplicate?.status === "pending") {
      return { ok: true, requestId: duplicate.id, tenantId: tenant.id, tenantName: tenant.name, slug: tenant.slug, created: false };
    }
    throw error;
  }
  return { ok: true, requestId: request.id, tenantId: tenant.id, tenantName: tenant.name, slug: tenant.slug, created: true };
}

export type ReviewTenantJoinRequestResult =
  | { ok: true; status: TenantJoinRequestStatus; requestId: string; tenantId: string; tenantName: string; slug: string; userId: string; userName: string }
  | { ok: false; error: string };

/** A pending request is the only state transition that can create membership. */
export async function reviewTenantMembershipRequest(
  db: PrismaClient,
  input: { requestId: string; reviewerId: string; status: "approved" | "rejected" },
): Promise<ReviewTenantJoinRequestResult> {
  const request = await db.tenantJoinRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      status: true,
      tenant: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!request || request.status !== "pending") return { ok: false, error: "This request is no longer pending." };

  const changed = await db.$transaction(async (tx) => {
    const update = await tx.tenantJoinRequest.updateMany({
      where: { id: request.id, status: "pending" },
      data: { status: input.status, reviewedAt: new Date(), reviewedById: input.reviewerId },
    });
    if (update.count !== 1) return false;
    if (input.status === "approved") {
      await tx.membership.createMany({
        data: [{ tenantId: request.tenantId, userId: request.userId, role: "member" }],
        skipDuplicates: true,
      });
    }
    return true;
  });
  if (!changed) return { ok: false, error: "This request was already reviewed." };

  return {
    ok: true,
    status: input.status,
    requestId: request.id,
    tenantId: request.tenantId,
    tenantName: request.tenant.name,
    slug: request.tenant.slug,
    userId: request.userId,
    userName: request.user.name ?? request.user.email,
  };
}
