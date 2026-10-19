import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import type { AgentContext } from "@/lib/agents/require-agent";
import { audit } from "@/lib/agents/audit";
import { IssueApiError } from "@/lib/agent-api/issues";

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
    const didRelease = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Bug" WHERE "id" = ${candidate.bugId} FOR NO KEY UPDATE`;
      // Re-read after locking: a heartbeat or another sweep may have won the race.
      const claim = await tx.issueClaim.findFirst({ where: { id: candidate.id, status: "active", releasedAt: null,
        bug: { projectId, tenantId: project.tenantId, isDeleted: false } } });
      const lastSeen = claim?.lastHeartbeatAt ?? claim?.claimedAt;
      if (!claim || !lastSeen || lastSeen.getTime() >= cutoff.getTime()) return false;
      const now = new Date();
      await tx.issueClaim.update({ where: { id: claim.id }, data: { status: "released", releasedAt: now, releaseReason: "silence" } });
      const otherClaim = await tx.issueClaim.count({ where: { bugId: claim.bugId, releasedAt: null, id: { not: claim.id } } });
      // Preserve a human's later reassignment or resolution and any newer claim.
      if (!otherClaim) await tx.bug.updateMany({ where: { id: claim.bugId, projectId, tenantId: project.tenantId,
        isDeleted: false, assigneeId: claim.beneficiaryUserId, status: "in_progress" }, data: { assigneeId: null, status: "open" } });
      await audit({ agentId: claim.agentId, tenantId: project.tenantId }, "claim.released", claim.bugId,
        { claimId: claim.id, reason: "silence", projectId }, { db: tx, bugId: claim.bugId, actorUserId: admin.id });
      return true;
    });
    if (didRelease) released++;
  }
  return { released };
}
