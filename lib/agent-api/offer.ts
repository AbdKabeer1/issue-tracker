import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { IssueApiError } from "@/lib/agent-api/issues";
import { isConfirmed } from "@/lib/agent-api/validation";
import { publish } from "@/lib/agent-api/events";
import { notifyClaimOffered } from "@/lib/agent-notifications";
import { MAX_ACTIVE_CLAIMS } from "@/lib/agent-api/claim";
import { canAssignTicket, WORK_READINESS_VOTE_THRESHOLD } from "@/lib/ticket-assignment";
import { assigneeChangedSummary, statusChangedSummary } from "@/lib/activity-log";
import { ensureWatching } from "@/lib/watch";
import { assertRedesignOpen } from "@/lib/redesigns";
import { deliveryDeadline, deliveryWindowMinutes } from "@/lib/claim-deadline";

export const OFFER_TTL_MS = 60_000;
const id = z.string().trim().min(1).max(191);
export const offerSchema = z.object({ projectId: id.optional() }).strict();

type Db = typeof prisma | Prisma.TransactionClient;
export type OfferCandidate = { beneficiaryUserId: string; agentId: string; activeClaims: number; lastOfferedAt: Date | null; pendingOffer?: boolean; volunteered?: boolean };

export function isOfferExpired(offeredAt: Date | null, now = Date.now()): boolean {
  return !offeredAt || now - offeredAt.getTime() >= OFFER_TTL_MS;
}

export function rankOfferCandidates<T extends OfferCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) =>
    (b.volunteered ? 1 : 0) - (a.volunteered ? 1 : 0)
    || a.activeClaims - b.activeClaims
    || (a.lastOfferedAt?.getTime() ?? Number.NEGATIVE_INFINITY) - (b.lastOfferedAt?.getTime() ?? Number.NEGATIVE_INFINITY)
    || a.beneficiaryUserId.localeCompare(b.beneficiaryUserId));
}

export function availableOfferCandidates<T extends OfferCandidate>(candidates: T[]): T[] {
  return rankOfferCandidates(candidates.filter((person) => person.activeClaims < MAX_ACTIVE_CLAIMS && !person.pendingOffer));
}

/** Re-arm the expiry that releases an offer nobody accepted. Exported for the stale-claim sweep (#524). */
export function scheduleOfferExpiry(claimId: string): void {
  setTimeout(() => { void expireOffer(claimId).catch(() => undefined); }, OFFER_TTL_MS);
}

/** Picks by active workload, then by who has waited longest since their last offer.
 * Exported for the stale-claim sweep (#524), which re-offers a reopened issue with no agent caller. */
export async function offerNext(db: Db, caller: { agentId?: string; tenantId: string }, bug: { id: string; projectId: string; title: string; assigneeId?: string | null }, excludeUserIds: string[] = []) {
  // Lock the Bug row first to serialize offer creation on this issue across concurrent calls (#680).
  await db.$queryRaw`SELECT "id" FROM "Bug" WHERE "id" = ${bug.id} FOR NO KEY UPDATE`;

  const existingOffer = await db.issueClaim.findFirst({
    where: {
      bugId: bug.id,
      releasedAt: null,
      OR: [
        { status: "active" },
        { status: "offered", offeredAt: { gt: new Date(Date.now() - OFFER_TTL_MS) } },
      ],
    },
    select: { id: true },
  });
  if (existingOffer) return null;
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
  const people = memberships.flatMap((m) => m.user.agents[0] && !excludeUserIds.includes(m.userId) && (!bug.assigneeId || bug.assigneeId === m.userId)
    ? [{ beneficiaryUserId: m.userId, agentId: m.user.agents[0].id }]
    : []);
  if (!people.length) return null;

  const active = await db.issueClaim.groupBy({
    by: ["beneficiaryUserId"],
    where: { beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) }, releasedAt: null, status: "active", bug: { tenantId: caller.tenantId, projectId: bug.projectId } },
    _count: { _all: true },
  });
  const counts = new Map(active.map((row) => [row.beneficiaryUserId, row._count._all]));
  const offers = await db.issueClaim.groupBy({
    by: ["beneficiaryUserId"],
    where: { beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) }, offeredAt: { not: null }, bug: { tenantId: caller.tenantId } },
    _max: { offeredAt: true },
  });
  const lastOffered = new Map(offers.map((row) => [row.beneficiaryUserId, row._max.offeredAt]));

  const pendingCutoff = new Date(Date.now() - OFFER_TTL_MS);
  const pending = await db.issueClaim.groupBy({
    by: ["beneficiaryUserId"],
    where: {
      beneficiaryUserId: { in: people.map((p) => p.beneficiaryUserId) },
      status: "offered",
      releasedAt: null,
      offeredAt: { gt: pendingCutoff },
      bug: { tenantId: caller.tenantId },
    },
  });
  const pendingPeople = new Set(pending.map((row) => row.beneficiaryUserId));
  const candidates: OfferCandidate[] = people.map((p) => ({
    ...p, activeClaims: counts.get(p.beneficiaryUserId) ?? 0,
    lastOfferedAt: lastOffered.get(p.beneficiaryUserId) ?? null,
    pendingOffer: pendingPeople.has(p.beneficiaryUserId),
  }));

  const next = availableOfferCandidates(candidates)[0];
  if (!next) return null;

  // Lock only the chosen member (#544) instead of looping over every member.
  await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${next.beneficiaryUserId} FOR NO KEY UPDATE`;
  try {
    const claim = await db.issueClaim.create({ data: {
      bugId: bug.id, beneficiaryUserId: next.beneficiaryUserId, agentId: next.agentId, status: "offered", offeredAt: new Date(),
    } });
    const event = await publish(db, { tenantId: caller.tenantId, type: "claim.offered", actorAgentId: caller.agentId, bugId: bug.id,
      payload: { claimId: claim.id, issueId: bug.id, projectId: bug.projectId, beneficiaryUserId: next.beneficiaryUserId, expiresAt: new Date(claim.offeredAt!.getTime() + OFFER_TTL_MS).toISOString() } });
    return { claim, beneficiaryUserId: next.beneficiaryUserId, bugTitle: bug.title, eventId: event.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

export async function offerIssue(agent: AgentContext, projectId: string, bugId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Bug" WHERE "id" = ${bugId} AND "tenantId" = ${agent.tenantId} AND "projectId" = ${projectId} AND "isDeleted" = false FOR NO KEY UPDATE`;
    if (!locked.length) throw new IssueApiError(404, "Issue not found in this project.");
    const bug = await tx.bug.findFirst({ where: { id: bugId, tenantId: agent.tenantId, projectId, isDeleted: false }, select: { id: true, title: true, projectId: true, status: true, assigneeId: true, voteCount: true } });
    if (!bug) throw new IssueApiError(404, "Issue not found in this project.");
    if (bug.status !== "open") throw new IssueApiError(409, "Only open issues can be offered.");
    if (bug.voteCount < WORK_READINESS_VOTE_THRESHOLD) throw new IssueApiError(409, `The issue must reach at least ${WORK_READINESS_VOTE_THRESHOLD} upvotes before it can be offered.`);
    if (!await isConfirmed(bugId, tx)) throw new IssueApiError(409, "The issue must be confirmed before it can be offered.");
    await assertRedesignOpen(bugId, tx);
    const current = await tx.issueClaim.findFirst({ where: { bugId, releasedAt: null } });
    if (current) {
      if (current.status === "offered" && !isOfferExpired(current.offeredAt)) {
        return { claim: current, beneficiaryUserId: current.beneficiaryUserId, bugTitle: bug.title, created: false };
      }
      if (current.status === "active") throw new IssueApiError(409, "This issue already has an active claim.");
      await tx.issueClaim.update({ where: { id: current.id }, data: { status: "released", releasedAt: new Date(), releaseReason: "expired" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId,
        payload: { claimId: current.id, issueId: bugId, reason: "expired" } });
    }
    const next = await offerNext(tx, agent, bug);
    if (!next) throw new IssueApiError(409, "No eligible person is available for this offer.");
    return { ...next, created: true };
  });
  if (result.created) {
    notifyClaimOffered({ id: result.claim.id, bugId, bugTitle: result.bugTitle, beneficiaryUserId: result.beneficiaryUserId });
    scheduleOfferExpiry(result.claim.id);
  }
  return result.claim;
}

/** Durable expiry state is checked here and again on acceptance after restarts. */
export async function expireOffer(claimId: string): Promise<void> {
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

/**
 * Sweeps and expires all pending offers whose TTL has elapsed (#681).
 * Durable across process restarts; safe to run from a cron or interval.
 */
export async function sweepExpiredOffers(tenantId?: string): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - OFFER_TTL_MS);
  const candidates = await prisma.issueClaim.findMany({
    where: {
      status: "offered",
      releasedAt: null,
      offeredAt: { lte: cutoff },
      ...(tenantId ? { bug: { tenantId } } : {}),
    },
    select: { id: true },
  });
  let expired = 0;
  for (const c of candidates) {
    await expireOffer(c.id);
    expired++;
  }
  return { expired };
}

export async function acceptOffer(agent: AgentContext, claimId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.issueClaim.findUnique({ where: { id: claimId }, include: { beneficiary: { select: { name: true } }, bug: { select: { id: true, title: true, status: true, assigneeId: true, tenantId: true, projectId: true, voteCount: true, severity: true, project: { select: { deliveryWindowMinutes: true } }, assignee: { select: { name: true } } } } } });
    if (!claim || claim.bug.tenantId !== agent.tenantId) throw new IssueApiError(404, "Offer not found.");
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Bug" WHERE "id" = ${claim.bugId} AND "tenantId" = ${agent.tenantId} FOR NO KEY UPDATE`;
    if (!locked.length) throw new IssueApiError(404, "Offer not found.");
    const fresh = await tx.issueClaim.findUnique({ where: { id: claimId }, include: { beneficiary: { select: { name: true } }, bug: { select: { id: true, title: true, status: true, assigneeId: true, tenantId: true, projectId: true, voteCount: true, severity: true, project: { select: { deliveryWindowMinutes: true } }, assignee: { select: { name: true } } } } } });
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
    if (fresh.bug.status !== "open" || !canAssignTicket({ actorId: fresh.beneficiaryUserId, actorRole: "user", currentAssigneeId: fresh.bug.assigneeId, targetAssigneeId: fresh.beneficiaryUserId, voteCount: fresh.bug.voteCount })) {
      await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "released", releasedAt: now, releaseReason: "unavailable" } });
      await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId: fresh.bugId,
        payload: { claimId: fresh.id, issueId: fresh.bugId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "unavailable" } });
      return { unavailable: true as const };
    }
    const deliverBy = deliveryDeadline(now, deliveryWindowMinutes(fresh.bug.severity, fresh.bug.project?.deliveryWindowMinutes));
    await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "active", claimedAt: now, lastHeartbeatAt: now, deliverBy } });
    const issue = await tx.bug.update({ where: { id: fresh.bugId }, data: { assigneeId: fresh.beneficiaryUserId, status: "in_progress" }, select: { id: true, assigneeId: true, status: true } });
    await tx.bugActivity.createMany({ data: [
      ...(fresh.bug.assigneeId !== fresh.beneficiaryUserId ? [{ bugId: fresh.bugId, actorId: fresh.beneficiaryUserId, type: "assignee_changed" as const, summary: assigneeChangedSummary(fresh.bug.assignee?.name ?? null, fresh.beneficiary.name), metadata: { field: "assignee", from: fresh.bug.assigneeId, to: fresh.beneficiaryUserId } }] : []),
      { bugId: fresh.bugId, actorId: fresh.beneficiaryUserId, type: "status_changed", summary: statusChangedSummary("open", "in_progress"), metadata: { field: "status", from: "open", to: "in_progress" } },
    ] });
    await ensureWatching(tx, fresh.bugId, [fresh.beneficiaryUserId]);
    await publish(tx, { tenantId: agent.tenantId, type: "claim.accepted", actorAgentId: agent.agentId, bugId: fresh.bugId,
      payload: { claimId: fresh.id, issueId: fresh.bugId, projectId: fresh.bug.projectId, beneficiaryUserId: fresh.beneficiaryUserId } });
    return { expired: false as const, claim: { ...fresh, status: "active", claimedAt: now, deliverBy }, issue };
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

export const releaseSchema = z.object({
  projectId: id.optional(),
  /** Why the agent is giving the work back, shown in the audit log. */
  reason: z.string().trim().max(500).optional(),
}).strict();

/**
 * An agent gives back an issue it holds (#547): declines a pending offer, or
 * releases an active claim it can't finish. Either way the issue goes to the
 * next person, without waiting for an offer to expire or a heartbeat to lapse.
 *
 * - Only the agent holding the offer or claim can release it.
 * - releaseReason is "declined" for an offer and "agent" for an active claim.
 *   Neither counts as a silence release, so giving work back promptly is never
 *   penalised the way going quiet is.
 * - An active claim's issue goes back to open and unassigned, unless a person
 *   has reassigned or resolved it since.
 * - The issue is then offered to someone else (never straight back to the
 *   same person), if it is still open and confirmed.
 */
export async function releaseClaim(agent: AgentContext, projectId: string, bugId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Bug" WHERE "id" = ${bugId} AND "tenantId" = ${agent.tenantId} AND "projectId" = ${projectId} AND "isDeleted" = false FOR NO KEY UPDATE`;
    if (!locked.length) throw new IssueApiError(404, "Issue not found in this project.");
    const claim = await tx.issueClaim.findFirst({
      where: { bugId, agentId: agent.agentId, releasedAt: null, status: { in: ["offered", "active"] } },
      include: { beneficiary: { select: { name: true } } },
    });
    if (!claim) throw new IssueApiError(409, "This agent holds no offer or claim on this issue.");
    const now = new Date();
    const releaseReason = claim.status === "offered" ? "declined" : "agent";
    await tx.issueClaim.update({ where: { id: claim.id }, data: { status: "released", releasedAt: now, releaseReason } });

    const bug = await tx.bug.findFirstOrThrow({
      where: { id: bugId },
      select: { id: true, title: true, status: true, assigneeId: true, projectId: true },
    });
    let reopened = false;
    if (claim.status === "active") {
      const otherOpen = await tx.issueClaim.count({ where: { bugId, releasedAt: null, id: { not: claim.id } } });
      if (!otherOpen && bug.status === "in_progress" && bug.assigneeId === claim.beneficiaryUserId) {
        await tx.bug.update({ where: { id: bugId }, data: { assigneeId: null, status: "open" } });
        await tx.bugActivity.createMany({ data: [
          { bugId, actorId: claim.beneficiaryUserId, type: "assignee_changed", summary: assigneeChangedSummary(claim.beneficiary.name, null), metadata: { field: "assignee", from: claim.beneficiaryUserId, to: null } },
          { bugId, actorId: claim.beneficiaryUserId, type: "status_changed", summary: statusChangedSummary("in_progress", "open"), metadata: { field: "status", from: "in_progress", to: "open" } },
        ] });
        reopened = true;
      }
    }
    await publish(tx, { tenantId: agent.tenantId, type: "claim.released", actorAgentId: agent.agentId, bugId,
      payload: { claimId: claim.id, issueId: bugId, beneficiaryUserId: claim.beneficiaryUserId, reason: releaseReason, ...(reason ? { note: reason } : {}) } });

    const stillOpen = claim.status === "offered" ? bug.status === "open" : reopened;
    const next = stillOpen && (await isConfirmed(bugId, tx))
      ? await offerNext(tx, agent, { ...bug, assigneeId: null }, [claim.beneficiaryUserId])
      : null;
    return {
      released: { claimId: claim.id, issueId: bugId, reason: releaseReason, reopened: claim.status === "active" ? reopened : false },
      next,
    };
  }, { maxWait: 10000, timeout: 15000 });
  if (result.next) {
    notifyClaimOffered({ id: result.next.claim.id, bugId, bugTitle: result.next.bugTitle, beneficiaryUserId: result.next.beneficiaryUserId });
    scheduleOfferExpiry(result.next.claim.id);
  }
  return { ...result.released, reofferedTo: result.next?.beneficiaryUserId ?? null };
}
