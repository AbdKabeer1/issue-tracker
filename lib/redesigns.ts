import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { audit } from "@/lib/agents/audit";
import { publish } from "@/lib/agent-api/events";
import { notifyApprovalNeeded } from "@/lib/agent-notifications";
import { IssueApiError } from "@/lib/agent-api/issues";

const id = z.string().trim().min(1).max(191);
export const redesignSchema = z.object({
  projectId: id, onBehalfOfUserId: id.optional(), bugId: id.optional(),
  title: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(5000),
}).strict();
export const redesignDecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) }).strict();

export async function proposeRedesign(agent: AgentContext, input: z.infer<typeof redesignSchema>) {
  const onBehalfOfUserId = input.onBehalfOfUserId ?? agent.ownerId;
  const proposal = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({ where: { id: input.projectId, tenantId: agent.tenantId }, select: { id: true } });
    if (!project) throw new IssueApiError(404, "Project not found.");
    const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: agent.tenantId, userId: onBehalfOfUserId } }, select: { userId: true } });
    if (!member) throw new IssueApiError(422, "The person must belong to the tenant.");
    if (input.bugId && !await tx.bug.findFirst({ where: { id: input.bugId, tenantId: agent.tenantId, projectId: input.projectId, isDeleted: false }, select: { id: true } })) {
      throw new IssueApiError(404, "Linked issue not found in this project.");
    }
    const created = await tx.redesignProposal.create({ data: {
      ...input, onBehalfOfUserId, tenantId: agent.tenantId, authorAgentId: agent.agentId, status: "proposed",
    } });
    await audit(agent, "redesign.proposed", created.id, { onBehalfOfUserId }, { db: tx, bugId: created.bugId });
    await publish(tx, { tenantId: agent.tenantId, type: "redesign.proposed", actorAgentId: agent.agentId,
      bugId: created.bugId, payload: { proposalId: created.id, projectId: input.projectId, onBehalfOfUserId } });
    return created;
  });
  notifyApprovalNeeded({ id: proposal.id, title: proposal.title, onBehalfOfUserId, agent: { name: agent.name }, bugId: proposal.bugId });
  return proposal;
}

/** Only a person who currently belongs to this tenant may decide a pending proposal. */
export async function decideRedesign(userId: string, tenantId: string, proposalId: string, decision: "approved" | "rejected") {
  return prisma.$transaction(async (tx) => {
    const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { userId: true } });
    if (!member) throw new IssueApiError(403, "Workspace membership required.");
    const proposal = await tx.redesignProposal.findFirst({ where: { id: proposalId, tenantId } });
    if (!proposal) throw new IssueApiError(404, "Proposal not found.");
    const approvedAt = decision === "approved" ? new Date() : null;
    const updated = await tx.redesignProposal.updateMany({ where: { id: proposalId, tenantId, status: "proposed" },
      data: { status: decision, approverId: decision === "approved" ? userId : null, approvedAt } });
    if (!updated.count) throw new IssueApiError(409, "This proposal has already been decided.");
    await audit({ agentId: proposal.authorAgentId, tenantId }, `redesign.${decision}`, proposalId, { decision },
      { db: tx, actorUserId: userId, bugId: proposal.bugId });
    await publish(tx, { tenantId, type: `redesign.${decision}`, bugId: proposal.bugId,
      payload: { proposalId, decision, actorUserId: userId } });
    return { id: proposalId, status: decision, approverId: decision === "approved" ? userId : null, approvedAt };
  });
}

/** Claim callers may pass their transaction to keep this check with assignment. */
export async function assertRedesignOpen(bugId: string, db: PrismaClient | Prisma.TransactionClient = prisma): Promise<void> {
  const blocked = await db.redesignProposal.count({ where: { bugId, status: { not: "approved" } } });
  if (blocked) throw new IssueApiError(409, "This redesign is waiting for a person or was rejected.");
}
