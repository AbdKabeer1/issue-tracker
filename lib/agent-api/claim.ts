import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { IssueApiError } from "@/lib/agent-api/issues";
import { isConfirmed } from "@/lib/agent-api/validation";
import { canAssignTicket } from "@/lib/ticket-assignment";
import { assigneeChangedSummary, statusChangedSummary } from "@/lib/activity-log";
import { ensureWatching } from "@/lib/watch";
import { audit } from "@/lib/agents/audit";
import { publish } from "@/lib/agent-api/events";
import { assertRedesignOpen } from "@/lib/redesigns";

const id = z.string().trim().min(1).max(191);
export const claimSchema = z.object({ projectId: id.optional(), beneficiaryUserId: id.optional() }).strict();
export const MAX_ACTIVE_CLAIMS = 2;

export async function claimIssue(agent: AgentContext, projectId: string, bugId: string, beneficiaryUserId = agent.ownerId) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.membership.findUnique({
      where: { tenantId_userId: { tenantId: agent.tenantId, userId: beneficiaryUserId } }, select: { userId: true },
    });
    if (!member) throw new IssueApiError(422, "The beneficiary must belong to the tenant.");
    // Serialize capacity checks for a person, then lock the issue to prevent two people claiming it.
    const people = await tx.$queryRaw<{ id: string; name: string }[]>`
      SELECT "id", "name" FROM "User" WHERE "id" = ${beneficiaryUserId} FOR NO KEY UPDATE`;
    if (!people.length) throw new IssueApiError(422, "Beneficiary not found.");
    const issues = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Bug" WHERE "id" = ${bugId} AND "tenantId" = ${agent.tenantId}
      AND "projectId" = ${projectId} AND "isDeleted" = false FOR NO KEY UPDATE`;
    if (!issues.length) throw new IssueApiError(404, "Issue not found in this project.");
    const bug = await tx.bug.findFirst({
      where: { id: bugId, tenantId: agent.tenantId, projectId, isDeleted: false },
      select: { id: true, status: true, assigneeId: true, assignee: { select: { name: true } } },
    });
    if (!bug) throw new IssueApiError(404, "Issue not found.");
    if (bug.status !== "open") throw new IssueApiError(409, "Only open issues can be claimed.");
    if (!await isConfirmed(bugId, tx)) throw new IssueApiError(409, "The issue must be confirmed before it can be claimed.");
    await assertRedesignOpen(bugId, tx);
    const activeCount = await tx.issueClaim.count({ where: {
      beneficiaryUserId, releasedAt: null, bug: { tenantId: agent.tenantId, projectId },
    } });
    if (activeCount >= MAX_ACTIVE_CLAIMS) throw new IssueApiError(409, "This person already holds two active claims in this project.");
    if (await tx.issueClaim.count({ where: { bugId, releasedAt: null } })) throw new IssueApiError(409, "This issue already has an active claim.");
    // Act for the named person's self-assignment; contributor keys do not grant admin takeovers.
    if (!canAssignTicket({ actorId: beneficiaryUserId, actorRole: "user", currentAssigneeId: bug.assigneeId, targetAssigneeId: beneficiaryUserId })) {
      throw new IssueApiError(409, "This issue is assigned to another person.");
    }
    const now = new Date();
    const claim = await tx.issueClaim.create({ data: {
      bugId, beneficiaryUserId, agentId: agent.agentId, status: "active", claimedAt: now, lastHeartbeatAt: now,
    } });
    const issue = await tx.bug.update({ where: { id: bugId }, data: { assigneeId: beneficiaryUserId, status: "in_progress" },
      select: { id: true, assigneeId: true, status: true } });
    const activities: Prisma.BugActivityCreateManyInput[] = [
      { bugId, actorId: beneficiaryUserId, type: "status_changed", summary: statusChangedSummary("open", "in_progress"),
        metadata: { field: "status", from: "open", to: "in_progress" } },
    ];
    if (bug.assigneeId !== beneficiaryUserId) activities.unshift({
      bugId, actorId: beneficiaryUserId, type: "assignee_changed", summary: assigneeChangedSummary(bug.assignee?.name ?? null, people[0].name),
      metadata: { field: "assignee", from: bug.assigneeId, to: beneficiaryUserId },
    });
    await tx.bugActivity.createMany({ data: activities });
    await ensureWatching(tx, bugId, [beneficiaryUserId]);
    await audit(agent, "issue.claimed", bugId, { claimId: claim.id, beneficiaryUserId }, { db: tx, bugId });
    await publish(tx, { tenantId: agent.tenantId, type: "claim.created", actorAgentId: agent.agentId, bugId,
      payload: { claimId: claim.id, issueId: bugId, projectId, beneficiaryUserId } });
    return { claim, issue };
  }, { maxWait: 10000, timeout: 15000 });
}
