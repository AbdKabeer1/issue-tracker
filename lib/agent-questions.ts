import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { audit } from "@/lib/agents/audit";
import { publish } from "@/lib/agent-api/events";
import { notifyAgentQuestion } from "@/lib/agent-notifications";
import { IssueApiError } from "@/lib/agent-api/issues";

/**
 * An agent asking its owner a question (#446). The agent stores the question
 * on `AgentQuestion`, tells its owner with an in-app notification, and writes
 * an event to the tenant feed. Only the owner answers, and the answer is set
 * once: a further question is a new row.
 *
 * Events are tenant-wide (#445), so they carry a reference to the question,
 * never its body or its answer. The asking agent reads the answer with
 * `readAgentQuestion`, which is scoped to that agent.
 */

const id = z.string().trim().min(1).max(191);

export const agentQuestionSchema = z
  .object({
    /** The issue the question is about, when there is one. */
    bugId: id.optional(),
    body: z.string().trim().min(3).max(2000),
  })
  .strict();

export const answerSchema = z.object({ answer: z.string().trim().min(1).max(2000) }).strict();

export type AskAgentQuestionInput = z.infer<typeof agentQuestionSchema>;

/** A contributor or above asks its owner. */
export async function askAgentQuestion(agent: AgentContext, input: AskAgentQuestionInput) {
  const question = await prisma.$transaction(async (tx) => {
    let bugTitle: string | null = null;
    if (input.bugId) {
      const bug = await tx.bug.findFirst({
        where: { id: input.bugId, tenantId: agent.tenantId, isDeleted: false },
        select: { id: true, title: true },
      });
      if (!bug) throw new IssueApiError(404, "Linked issue not found.");
      bugTitle = bug.title;
    }

    const created = await tx.agentQuestion.create({
      data: {
        agentId: agent.agentId,
        ownerUserId: agent.ownerId,
        bugId: input.bugId ?? null,
        body: input.body,
      },
      select: { id: true, bugId: true, body: true, createdAt: true },
    });

    await audit(agent, "question.asked", created.id, { bugId: created.bugId }, { db: tx, bugId: created.bugId });
    await publish(tx, {
      tenantId: agent.tenantId,
      type: "question.asked",
      payload: { questionId: created.id, agentId: agent.agentId, bugId: created.bugId },
      actorAgentId: agent.agentId,
      bugId: created.bugId,
    });

    return { ...created, bugTitle };
  });

  // Queue the owner's notification after the row commits, like #443 does.
  notifyAgentQuestion({
    id: question.id,
    body: question.body,
    tenantId: agent.tenantId,
    ownerUserId: agent.ownerId,
    agent: { name: agent.name },
    bugId: question.bugId,
    bugTitle: question.bugTitle,
  });
  return question;
}

/** The asking agent reads its own question and the answer, once there is one. */
export async function readAgentQuestion(agent: AgentContext, questionId: string) {
  const question = await prisma.agentQuestion.findFirst({
    where: { id: questionId, agentId: agent.agentId },
    select: { id: true, body: true, answer: true, answeredAt: true, bugId: true, createdAt: true },
  });
  if (!question) throw new IssueApiError(404, "Question not found.");
  return question;
}

/**
 * Only the owner answers, and only once. The update is guarded on `answer:
 * null` so two answers racing can't both win.
 */
export async function answerAgentQuestion(userId: string, tenantId: string, questionId: string, answer: string) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { userId: true },
    });
    if (!member) throw new IssueApiError(403, "Workspace membership required.");

    const question = await tx.agentQuestion.findFirst({
      where: { id: questionId, agent: { tenantId } },
      select: { id: true, agentId: true, bugId: true, ownerUserId: true },
    });
    if (!question) throw new IssueApiError(404, "Question not found.");
    if (question.ownerUserId !== userId) throw new IssueApiError(403, "Only the owner can answer this question.");

    const answeredAt = new Date();
    const updated = await tx.agentQuestion.updateMany({
      where: { id: questionId, answer: null },
      data: { answer, answeredAt },
    });
    if (!updated.count) throw new IssueApiError(409, "That question has already been answered.");

    await audit({ agentId: question.agentId, tenantId }, "question.answered", questionId, { answeredAt }, {
      db: tx,
      actorUserId: userId,
      bugId: question.bugId,
    });
    await publish(tx, {
      tenantId,
      type: "question.answered",
      payload: { questionId, agentId: question.agentId, bugId: question.bugId, answeredAt },
      bugId: question.bugId,
    });

    return { id: questionId, answer, answeredAt };
  });
}

/** The owner's list, unanswered questions first. */
export async function listOwnerQuestions(userId: string, tenantId: string) {
  return prisma.agentQuestion.findMany({
    where: { ownerUserId: userId, agent: { tenantId } },
    orderBy: [{ answeredAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      body: true,
      answer: true,
      answeredAt: true,
      bugId: true,
      createdAt: true,
      agent: { select: { id: true, name: true } },
      bug: { select: { id: true, title: true } },
    },
  });
}

/** Count unresolved / pending escalations for an owner in the workspace (#763). */
export async function countPendingEscalations(userId: string, tenantId: string): Promise<number> {
  return prisma.agentQuestion.count({
    where: {
      ownerUserId: userId,
      answeredAt: null,
      agent: { tenantId },
    },
  });
}

/** Escalations linked to a specific issue/ticket (#763). */
export async function listBugEscalations(bugId: string, tenantId: string) {
  return prisma.agentQuestion.findMany({
    where: {
      bugId,
      agent: { tenantId },
    },
    orderBy: [{ answeredAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      body: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
      agent: { select: { id: true, name: true } },
    },
  });
}

export type EscalationType =
  | "Blocker"
  | "Work Authorization"
  | "Question"
  | "Scope Expansion"
  | "Human Approval";

/**
 * Classifies an agent escalation into a standard human-actionable type (#763).
 */
export function classifyEscalation(body: string): EscalationType {
  const lower = body.toLowerCase();
  if (
    lower.includes("block") ||
    lower.includes("stuck") ||
    lower.includes("impediment") ||
    lower.startsWith("[blocker]")
  ) {
    return "Blocker";
  }
  if (
    lower.includes("authoriz") ||
    lower.includes("permission") ||
    lower.includes("start work") ||
    lower.includes("bid") ||
    lower.startsWith("[work authorization]")
  ) {
    return "Work Authorization";
  }
  if (
    lower.includes("scope") ||
    lower.includes("expand") ||
    lower.includes("out of scope") ||
    lower.includes("refactor") ||
    lower.startsWith("[scope expansion]")
  ) {
    return "Scope Expansion";
  }
  if (
    lower.includes("approv") ||
    lower.includes("sign off") ||
    lower.includes("confirm") ||
    lower.includes("review") ||
    lower.startsWith("[human approval]")
  ) {
    return "Human Approval";
  }
  return "Question";
}

/** One question for its owner, or `null` so the page can 404 anyone else. */
export async function ownerQuestion(userId: string, tenantId: string, questionId: string) {
  return prisma.agentQuestion.findFirst({
    where: { id: questionId, ownerUserId: userId, agent: { tenantId } },
    select: {
      id: true,
      body: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
      agent: { select: { name: true } },
      bug: { select: { id: true, title: true } },
    },
  });
}
