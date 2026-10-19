import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { IssueApiError } from "@/lib/agent-api/issues";
import { isConfirmed } from "@/lib/agent-api/validation";
import { publish } from "@/lib/agent-api/events";
import { notifyClaimOffered } from "@/lib/agent-notifications";
import { MAX_ACTIVE_CLAIMS } from "@/lib/agent-api/claim";
import { canAssignTicket } from "@/lib/ticket-assignment";
import { assigneeChangedSummary, statusChangedSummary } from "@/lib/activity-log";
import { ensureWatching } from "@/lib/watch";
import { assertRedesignOpen } from "@/lib/redesigns";

export const OFFER_TTL_MS = 60_000;
const id = z.string().trim().min(1).max(191);
export const offerSchema = z.object({ projectId: id.optional() }).strict();

type Db = typeof prisma | Prisma.TransactionClient;
type OfferCandidate = { beneficiaryUserId: string; agentId: string; activeClaims: number; lastOfferedAt: Date | null; pendingOffer?: boolean };

export function isOfferExpired(offeredAt: Date | null, now = Date.now()): boolean {
  return !offeredAt || now - offeredAt.getTime() >= OFFER_TTL_MS;
}

export function rankOfferCandidates<T extends OfferCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => a.activeClaims - b.activeClaims
    || (a.lastOfferedAt?.getTime() ?? Number.NEGATIVE_INFINITY) - (b.lastOfferedAt?.getTime() ?? Number.NEGATIVE_INFINITY)
    || a.beneficiaryUserId.localeCompare(b.beneficiaryUserId));
}

export function availableOfferCandidates<T extends OfferCandidate>(candidates: T[]): T[] {
  return rankOfferCandidates(candidates.filter((person) => person.activeClaims < MAX_ACTIVE_CLAIMS && !person.pendingOffer));
}

function scheduleOfferExpiry(claimId: string): void {
  setTimeout(() => { void expireOffer(claimId).catch(() => undefined); }, OFFER_TTL_MS);
}

/** Picks by active workload, then by who has waited longest since their last offer. */
async function offerNext(db: Db, caller: { agentId?: string; tenantId: string }, bug: { id: string; projectId: string; title: string; assigneeId?: string | null }) {
  const memberships = await db.membership.findMany({
    where: {
      tenantId: caller.tenantId,
      user: { agents: { some: { tenantId: caller.tenantId, revokedAt: null, level: { in: ["contributor", "reviewer", "merger"] } } } },
    },
    select: { userId: true, user: { select: { agents: {
      where: { tenantId: caller.tenantId, revokedAt: null, level: { in: ["contributor", "reviewer", "merger"] } },
      orderBy: { createdAt: "asc" }, take: 1, select: { id: true },
    } } } },
  });
  const people = memberships.flatMap((m) => m.user.agents[0] && (!bug.assigneeId || bug.assigneeId === m.userId)
    ? [{ beneficiaryUserId: m.userId, agentId: m.user.agents[0].id }]
    : []);
  if (!people.length) return null;
  // Serialize offer selection across issues so a person cannot accumulate
  // simultaneous pending offers while their active-claim count is stale.
  for (const userId of people.map((person) => person.beneficiaryUserId).sort()) {
    await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
  }

  const active = await db.issueClaim.groupBy({
    by: ["beneficiaryUserId"],
    where: { beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) }, releasedAt: null, status: "active", bug: { tenantId: caller.tenantId, projectId: bug.projectId } },
    _count: { _all: true },
  });
  const counts = new Map(active.map((row) => [row.beneficiaryUserId, row._count._all]));
  const offers = await db.issueClaim.findMany({
    where: { beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) }, offeredAt: { not: null }, bug: { tenantId: caller.tenantId } },
    orderBy: { offeredAt: "desc" }, select: { beneficiaryUserId: true, offeredAt: true },
  });
  const lastOffered = new Map<string, Date>();
  for (const row of offers) if (row.offeredAt && !lastOffered.has(row.beneficiaryUserId)) lastOffered.set(row.beneficiaryUserId, row.offeredAt);

  const pending = await db.issueClaim.findMany({ where: { beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) }, status: "offered", releasedAt: null, bug: { tenantId: caller.tenantId } }, select: { beneficiaryUserId: true } });
  const pendingPeople = new Set(pending.map((row) => row.beneficiaryUserId));
  const candidates: OfferCandidate[] = people.map((p) => ({
    ...p, activeClaims: counts.get(p.beneficiaryUserId) ?? 0,
    lastOfferedAt: lastOffered.get(p.beneficiaryUserId) ?? null,
    pendingOffer: pendingPeople.has(p.beneficiaryUserId),
  }));
  const next = availableOfferCandidates(candidates)[0];
  if (!next) return null;
  const claim = await db.issueClaim.create({ data: {
    bugId: bug.id, beneficiaryUserId: next.beneficiaryUserId, agentId: next.agentId, status: "offered", offeredAt: new Date(),
  } });
  const event = await publish(db, { tenantId: caller.tenantId, type: "claim.offered", actorAgentId: caller.agentId, bugId: bug.id,
    payload: { claimId: claim.id, issueId: bug.id, projectId: bug.projectId, beneficiaryUserId: next.beneficiaryUserId, expiresAt: new Date(claim.offeredAt!.getTime() + OFFER_TTL_MS).toISOString() } });
  return { claim, beneficiaryUserId: next.beneficiaryUserId, bugTitle: bug.title, eventId: event.id };
}

export async function offerIssue(agent: AgentContext, projectId: string, bugId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Bug" WHERE "id" = ${bugId} AND "tenantId" = ${agent.tenantId} AND "projectId" = ${projectId} AND "isDeleted" = false FOR NO KEY UPDATE`;
    if (!locked.length) throw new IssueApiError(404, "Issue not found in this project.");
    const bug = await tx.bug.findFirst({ where: { id: bugId, tenantId: agent.tenantId, projectId, isDeleted: false }, select: { id: true, title: true, projectId: true, status: true, assigneeId: true } });
    if (!bug) throw new IssueApiError(404, "Issue not found in this project.");
    if (bug.status !== "open") throw new IssueApiError(409, "Only open issues can be offered.");
    if (!await isConfirmed(bugId, tx)) throw new IssueApiError(409, "The issue must be confirmed before it can be offered.");
    await assertRedesignOpen(bugId, tx);
    const current = await tx.issueClaim.findFirst({ where: { bugId, releasedAt: null }, select: { id: true, status: true, offeredAt: true } });
    if (current) {
      if (current.status === "offered" && !isOfferExpired(current.offeredAt)) throw new IssueApiError(409, "This issue already has a pending offer.");
      if (current.status === "active") throw new IssueApiError(409, "This issue already has an active claim.");
      await tx.issueClaim.update({ where: { id: current.id }, data: { status: "released", releasedAt: new Date(), releaseReason: "expired" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId,
        payload: { claimId: current.id, issueId: bugId, reason: "expired" } });
    }
    const next = await offerNext(tx, agent, bug);
    if (!next) throw new IssueApiError(409, "No eligible person is available for this offer.");
    return next;
  });
  notifyClaimOffered({ id: result.claim.id, bugId, bugTitle: result.bugTitle, beneficiaryUserId: result.beneficiaryUserId });
  scheduleOfferExpiry(result.claim.id);
  return result.claim;
}

/** Durable expiry state is checked here and again on acceptance after restarts. */
async function expireOffer(claimId: string): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.issueClaim.findUnique({ where: { id: claimId }, select: { id: true, bugId: true, status: true, offeredAt: true, releasedAt: true, agentId: true, beneficiaryUserId: true, bug: { select: { tenantId: true, id: true, title: true, projectId: true, assigneeId: true } } } });
    if (!claim || claim.status !== "offered" || claim.releasedAt || !isOfferExpired(claim.offeredAt)) return null;
    await tx.$queryRaw`SELECT "id" FROM "Bug" WHERE "id" = ${claim.bugId} FOR NO KEY UPDATE`;
    const fresh = await tx.issueClaim.findUnique({ where: { id: claimId }, select: { id: true, bugId: true, status: true, offeredAt: true, releasedAt: true, agentId: true, beneficiaryUserId: true, bug: { select: { tenantId: true, id: true, title: true, projectId: true, assigneeId: true } } } });
    if (!fresh || fresh.status !== "offered" || fresh.releasedAt || !isOfferExpired(fresh.offeredAt)) return null;
    const now = new Date();
    await tx.issueClaim.update({ where: { id: claimId }, data: { status: "released", releasedAt: now, releaseReason: "expired" } });
    await publish(tx, { tenantId: fresh.bug.tenantId, type: "claim.released", actorAgentId: fresh.agentId, bugId: fresh.bugId,
      payload: { claimId, issueId: fresh.bugId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "expired" } });
    return offerNext(tx, { tenantId: fresh.bug.tenantId }, fresh.bug);
  });
  if (result) {
    notifyClaimOffered({ id: result.claim.id, bugId: result.claim.bugId, bugTitle: result.bugTitle, beneficiaryUserId: result.beneficiaryUserId });
    scheduleOfferExpiry(result.claim.id);
  }
}

export async function acceptOffer(agent: AgentContext, claimId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.issueClaim.findUnique({ where: { id: claimId }, include: { beneficiary: { select: { name: true } }, bug: { select: { id: true, title: true, status: true, assigneeId: true, tenantId: true, projectId: true, assignee: { select: { name: true } } } } } });
    if (!claim || claim.bug.tenantId !== agent.tenantId) throw new IssueApiError(404, "Offer not found.");
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Bug" WHERE "id" = ${claim.bugId} AND "tenantId" = ${agent.tenantId} FOR NO KEY UPDATE`;
    if (!locked.length) throw new IssueApiError(404, "Offer not found.");
    const fresh = await tx.issueClaim.findUnique({ where: { id: claimId }, include: { beneficiary: { select: { name: true } }, bug: { select: { id: true, title: true, status: true, assigneeId: true, tenantId: true, projectId: true, assignee: { select: { name: true } } } } } });
    if (!fresh || fresh.agentId !== agent.agentId) throw new IssueApiError(409, "This offer is no longer available to this agent.");
    if (fresh.status === "released" && fresh.releaseReason === "expired") throw new IssueApiError(410, "This offer expired and has been released.");
    if (fresh.status !== "offered" || fresh.releasedAt) throw new IssueApiError(409, "This offer is no longer available to this agent.");
    const now = new Date();
    if (isOfferExpired(fresh.offeredAt, now.getTime())) {
      await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "released", releasedAt: now, releaseReason: "expired" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId: fresh.bugId,
        payload: { claimId: fresh.id, issueId: fresh.bugId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "expired" } });
      const next = await offerNext(tx, agent, fresh.bug);
      return { expired: true as const, next, bugId: fresh.bugId };
    }
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${fresh.beneficiaryUserId} FOR NO KEY UPDATE`;
    const activeClaims = await tx.issueClaim.count({ where: {
      beneficiaryUserId: fresh.beneficiaryUserId, status: "active", releasedAt: null,
      bug: { tenantId: agent.tenantId, projectId: fresh.bug.projectId },
    } });
    if (activeClaims >= MAX_ACTIVE_CLAIMS) {
      await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "released", releasedAt: now, releaseReason: "capacity" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId: fresh.bugId,
        payload: { claimId: fresh.id, issueId: fresh.bugId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "capacity" } });
      const next = await offerNext(tx, agent, fresh.bug);
      return { unavailable: true as const, next, bugId: fresh.bugId };
    }
    if (fresh.bug.status !== "open" || !canAssignTicket({ actorId: fresh.beneficiaryUserId, actorRole: "user", currentAssigneeId: fresh.bug.assigneeId, targetAssigneeId: fresh.beneficiaryUserId })) {
      await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "released", releasedAt: now, releaseReason: "unavailable" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId: fresh.bugId,
        payload: { claimId: fresh.id, issueId: fresh.bugId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "unavailable" } });
      return { unavailable: true as const };
    }
    await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "active", claimedAt: now, lastHeartbeatAt: now } });
    const issue = await tx.bug.update({ where: { id: fresh.bugId }, data: { assigneeId: fresh.beneficiaryUserId, status: "in_progress" }, select: { id: true, assigneeId: true, status: true } });
    await tx.bugActivity.createMany({ data: [
      ...(fresh.bug.assigneeId !== fresh.beneficiaryUserId ? [{ bugId: fresh.bugId, actorId: fresh.beneficiaryUserId, type: "assignee_changed" as const, summary: assigneeChangedSummary(fresh.bug.assignee?.name ?? null, fresh.beneficiary.name), metadata: { field: "assignee", from: fresh.bug.assigneeId, to: fresh.beneficiaryUserId } }] : []),
      { bugId: fresh.bugId, actorId: fresh.beneficiaryUserId, type: "status_changed", summary: statusChangedSummary("open", "in_progress"), metadata: { field: "status", from: "open", to: "in_progress" } },
    ] });
    await ensureWatching(tx, fresh.bugId, [fresh.beneficiaryUserId]);
    await publish(tx, { tenantId: agent.tenantId, type: "claim.accepted", actorAgentId: agent.agentId, bugId: fresh.bugId,
      payload: { claimId: fresh.id, issueId: fresh.bugId, projectId: fresh.bug.projectId, beneficiaryUserId: fresh.beneficiaryUserId } });
    return { expired: false as const, claim: { ...fresh, status: "active", claimedAt: now }, issue };
  }, { maxWait: 10000, timeout: 15000 });
  if ("expired" in result && result.expired) {
    if (result.next) {
      notifyClaimOffered({ id: result.next.claim.id, bugId: result.bugId, bugTitle: result.next.bugTitle, beneficiaryUserId: result.next.beneficiaryUserId });
      scheduleOfferExpiry(result.next.claim.id);
    }
    throw new IssueApiError(410, "This offer expired and has been released.");
  }
  if ("unavailable" in result) {
    if ("next" in result && result.next) {
      notifyClaimOffered({ id: result.next.claim.id, bugId: result.bugId, bugTitle: result.next.bugTitle, beneficiaryUserId: result.next.beneficiaryUserId });
      scheduleOfferExpiry(result.next.claim.id);
    }
    throw new IssueApiError(409, "The issue can no longer be assigned to this person.");
  }
  return result;
}
