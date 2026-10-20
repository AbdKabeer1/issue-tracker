import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import type { AgentContext } from "@/lib/agents/require-agent";
import { audit, type AuditAgent } from "@/lib/agents/audit";
import { IssueApiError } from "@/lib/agent-api/issues";
import { publish } from "@/lib/agent-api/events";
import { notifyClaimOffered } from "@/lib/agent-notifications";
import { offerNext, scheduleOfferExpiry } from "@/lib/agent-api/offer";

type OfferNextResult = NonNullable<Awaited<ReturnType<typeof offerNext>>>;

const SILENCE_MS = 15 * 60 * 1000;

export async function heartbeatClaim(agent: AgentContext, projectId: string, bugId: string) {
  return prisma.$transaction(async (tx) => {
    // All claim transitions lock the issue first, including the stale-claim sweep.
    const issues = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Bug" WHERE "id" = ${bugId} AND "tenantId" = ${agent.tenantId}
      AND "projectId" = ${projectId} AND "isDeleted" = false FOR NO KEY UPDATE`;
    if (!issues.length) throw new IssueApiError(404, "Issue not found in this project.");
    const claim = await tx.issueClaim.findFirst({ where: { bugId, releasedAt: null }, orderBy: { createdAt: "desc" } });
    if (!claim) throw new IssueApiError(409, "This issue has no current claim.");
    if (claim.agentId !== agent.agentId) throw new IssueApiError(403, "Only the claiming agent can send a heartbeat.");
    if (claim.status !== "active") throw new IssueApiError(409, "Only active claims accept heartbeats.");
    return tx.issueClaim.update({ where: { id: claim.id }, data: { lastHeartbeatAt: new Date() } });
  });
}

// ---------------------------------------------------------------------------
// Stale-claim sweep (#524)
// ---------------------------------------------------------------------------

/** Where a released claim lives: the claim plus its bug's tenant and project. */
type StaleClaimRef = { id: string; bugId: string; bug: { tenantId: string; projectId: string } };

type ReleaseOutcome = {
  released: boolean;
  /** True when this release moved the issue back to `open` with no assignee. */
  opened: boolean;
  offered: boolean;
  offer: OfferNextResult | null;
 };

/**
 * Release one active claim whose agent stopped heartbeating, atomically:
 * lock the issue, re-read the claim, mark it `released` for `silence`,
 * publish a `claim.released` event, audit, reopen the issue when no human
 * assignment or newer claim intervenes, and offer it to the next agent.
 */
async function releaseClaimIfStale(
  claim: StaleClaimRef,
  cutoff: Date,
  options: { reOffer?: boolean; actorUserId?: string | null } = {},
): Promise<ReleaseOutcome> {
  const tenantId = claim.bug.tenantId;
  const projectId = claim.bug.projectId;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Bug" WHERE "id" = ${claim.bugId} FOR NO KEY UPDATE`;
    // Re-read after locking: a heartbeat or another sweep may have won the race.
    const fresh = await tx.issueClaim.findFirst({ where: { id: claim.id, status: "active", releasedAt: null,
      bug: { projectId, tenantId, isDeleted: false } } });
    const lastSeen = fresh?.lastHeartbeatAt ?? fresh?.claimedAt;
    const now = new Date();
    if (!fresh || !lastSeen || lastSeen.getTime() >= cutoff.getTime()) {
      return { released: false, opened: false, offered: false, offer: null };
    }
    await tx.issueClaim.update({ where: { id: fresh.id }, data: { status: "released", releasedAt: now, releaseReason: "silence" } });
    await publish(tx, { tenantId, type: "claim.released", actorAgentId: fresh.agentId, bugId: fresh.bugId,
      payload: { claimId: fresh.id, issueId: fresh.bugId, projectId, beneficiaryUserId: fresh.beneficiaryUserId, reason: "silence" } });
    await audit({ agentId: fresh.agentId, tenantId } satisfies AuditAgent, "claim.released", fresh.bugId,
      { claimId: fresh.id, reason: "silence", projectId }, { db: tx, bugId: fresh.bugId, actorUserId: options.actorUserId ?? null });
    const otherClaim = await tx.issueClaim.count({ where: { bugId: fresh.bugId, releasedAt: null, id: { not: fresh.id } } });
    let reopened = false;
    // Preserve a human's later reassignment or resolution and any newer claim.
    if (!otherClaim) {
      const reopenedRow = await tx.bug.updateMany({ where: { id: fresh.bugId, projectId, tenantId,
        isDeleted: false, assigneeId: fresh.beneficiaryUserId, status: "in_progress" }, data: { assigneeId: null, status: "open" } });
      reopened = reopenedRow.count > 0;
    }
    let offer: OfferNextResult | null = null;
    if (options.reOffer !== false && reopened) {
      const bug = await tx.bug.findFirst({ where: { id: fresh.bugId, tenantId, isDeleted: false },
        select: { id: true, projectId: true, title: true, assigneeId: true, status: true } });
      if (bug && bug.status === "open") offer = await offerNext(tx, { tenantId }, bug);
    }
    return { released: true, opened: reopened, offered: offer !== null, offer };
  });
  if (result.offer) {
    notifyClaimOffered({ id: result.offer.claim.id, bugId: claim.bugId, bugTitle: result.offer.bugTitle,
      beneficiaryUserId: result.offer.beneficiaryUserId });
    scheduleOfferExpiry(result.offer.claim.id);
  }
  return { released: result.released, opened: result.opened, offered: result.offered, offer: result.offer };
}

/** Super-admin server action. Invoke periodically from an authenticated admin context.
 * The active clock starts at claimedAt, never offeredAt or createdAt.
 */
export async function releaseStaleClaims(projectId: string) {
  "use server";
  const admin = await requireSuperAdmin();
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, tenantId: true } });
  if (!project) throw new IssueApiError(404, "Project not found.");
  const cutoff = new Date(Date.now() - SILENCE_MS);
  const candidates = await prisma.issueClaim.findMany({ where: {
    status: "active", releasedAt: null, bug: { projectId, tenantId: project.tenantId, isDeleted: false },
    OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, claimedAt: { lt: cutoff } }],
  }, select: { id: true, bugId: true } });
  let released = 0;
  for (const candidate of candidates) {
    const outcome = await releaseClaimIfStale(
      { ...candidate, bug: { tenantId: project.tenantId, projectId: project.id } },
      cutoff, { actorUserId: admin.id });
    if (outcome.released) released++;
  }
  return { released };
}

export type ClaimSweepResult = { released: number; offered: number };

/**
 * The scheduled sweep (#524): release every stale active claim across all
 * projects, publish `claim.released`, and re-offer every reopened issue.
 * Called by the protected `POST /api/v1/claims/dispatch` route; no agent
 * context, and actorUserId stays null (the scheduler acted, not a person).
 */
export async function sweepStaleClaims(limit = 50): Promise<ClaimSweepResult> {
  const cutoff = new Date(Date.now() - SILENCE_MS);
  const candidates = await prisma.issueClaim.findMany({ where: {
    status: "active", releasedAt: null, bug: { isDeleted: false },
    OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, claimedAt: { lt: cutoff } }],
  }, select: { id: true, bugId: true, bug: { select: { tenantId: true, projectId: true } } },
  orderBy: { createdAt: "asc" }, take: limit });
  let released = 0;
  let offered = 0;
  for (const candidate of candidates) {
    const outcome = await releaseClaimIfStale(candidate, cutoff);
    if (outcome.released) released++;
    if (outcome.offered) offered++;
  }
  return { released, offered };
}
