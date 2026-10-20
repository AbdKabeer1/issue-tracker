import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import {
  assertIndependentReviewer,
  ReviewerNotIndependentError,
  type ReviewedBug,
} from "@/lib/agents/independence";
import { hasLevel } from "@/lib/agents/levels";
import type { AgentContext } from "@/lib/agents/require-agent";
import { publish } from "@/lib/agent-api/events";

/**
 * Reviewer agents reporting whether a fix is good to merge (#434). A verdict
 * is one reviewer's opinion, not the decision: `merge.ts` accepts a fix only
 * once the issue is confirmed and two reviewers say it is good to merge.
 *
 * - Only `reviewer` and `merger` agents may file a verdict.
 * - The agent holding the active claim can't verdict its own fix (#432), and
 *   neither can any agent that fails `assertIndependentReviewer` (#442): same
 *   owner as the filer, the issue's own beneficiary, or the claim holder's
 *   owner.
 * - One verdict per agent per issue, so one agent can never satisfy the gate
 *   on its own.
 */

export const TEST_VERDICT_NOTES_MAX = 2000;

export const testVerdictBodySchema = z.object({
  goodToMerge: z.boolean(),
  notes: z.string().trim().max(TEST_VERDICT_NOTES_MAX).optional(),
  /** The person the agent acts for; defaults to its owner. */
  onBehalfOfUserId: z.string().trim().min(1).max(191).optional(),
});

export type TestVerdictBody = z.infer<typeof testVerdictBodySchema>;

/** What the independence rule and the claim-holder check need about an issue. */
const reviewedBugSelect = {
  id: true,
  tenantId: true,
  severity: true,
  beneficiaryUserId: true,
  createdByAgentId: true,
  createdByAgent: { select: { ownerUserId: true } },
  claims: {
    select: {
      status: true,
      releasedAt: true,
      agentId: true,
      agent: { select: { ownerUserId: true } },
    },
  },
} satisfies Prisma.BugSelect;

type LoadedBug = Prisma.BugGetPayload<{ select: typeof reviewedBugSelect }>;

/** The agent holding the active claim on `bug`, if any (#432). */
function activeClaimAgent(bug: LoadedBug): string | null {
  const claim = bug.claims.find((c) => c.status === "active" && !c.releasedAt);
  return claim?.agentId ?? null;
}

export type SubmitTestVerdictResult =
  | {
      status: 201;
      verdict: {
        id: string;
        goodToMerge: boolean;
        notes: string | null;
        onBehalfOfUserId: string;
      };
    }
  | { status: 400; error: "invalid_request"; message: string; field?: string }
  | { status: 403; error: "insufficient_level" | "fixer_cannot_verdict" | "not_independent"; message: string }
  | { status: 404; error: "not_found"; message: string }
  | { status: 409; error: "already_verdicted"; message: string };

export async function submitTestVerdict(
  agent: AgentContext,
  bugId: string,
  rawBody: unknown,
): Promise<SubmitTestVerdictResult> {
  if (!hasLevel(agent.level, "reviewer")) {
    return {
      status: 403,
      error: "insufficient_level",
      message: "Only reviewer or merger agents can report a test verdict.",
    };
  }

  const parsed = testVerdictBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 400,
      error: "invalid_request",
      message: issue?.message ?? "Invalid test verdict.",
      field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
    };
  }
  const body = parsed.data;

  const bug = await prisma.bug.findFirst({
    where: { id: bugId, tenantId: agent.tenantId, isDeleted: false },
    select: reviewedBugSelect,
  });
  if (!bug) return { status: 404, error: "not_found", message: "No such issue in this agent's tenant." };

  if (activeClaimAgent(bug) === agent.agentId) {
    return {
      status: 403,
      error: "fixer_cannot_verdict",
      message: "The agent working this issue can't verdict its own fix.",
    };
  }
  try {
    assertIndependentReviewer({ id: agent.agentId, ownerUserId: agent.ownerId }, bug as ReviewedBug);
  } catch (error) {
    if (!(error instanceof ReviewerNotIndependentError)) throw error;
    return { status: 403, error: "not_independent", message: error.message };
  }

  const onBehalfOfUserId = body.onBehalfOfUserId ?? agent.ownerId;
  if (onBehalfOfUserId !== agent.ownerId) {
    const member = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: agent.tenantId, userId: onBehalfOfUserId } },
      select: { id: true },
    });
    if (!member) {
      return {
        status: 400,
        error: "invalid_request",
        message: "onBehalfOfUserId must be a member of the agent's tenant.",
        field: "onBehalfOfUserId",
      };
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.testVerdict.findFirst({
      where: { bugId: bug.id, agentId: agent.agentId },
      select: { id: true },
    });
    if (existing) {
      return {
        status: 409 as const,
        error: "already_verdicted" as const,
        message: "This agent has already reported a verdict on this issue.",
      };
    }

    const verdict = await tx.testVerdict.create({
      data: {
        bugId: bug.id,
        agentId: agent.agentId,
        onBehalfOfUserId,
        goodToMerge: body.goodToMerge,
        notes: body.notes || null,
      },
      select: { id: true, goodToMerge: true, notes: true, onBehalfOfUserId: true },
    });

    await audit(
      agent,
      "issue.test_verdict",
      `bug:${bug.id}`,
      { verdictId: verdict.id, goodToMerge: body.goodToMerge, onBehalfOfUserId },
      { bugId: bug.id, db: tx },
    );
    await publish(tx, {
      tenantId: bug.tenantId,
      type: "issue.test_verdict",
      payload: { issueId: bug.id, verdictId: verdict.id, goodToMerge: body.goodToMerge, onBehalfOfUserId },
      actorAgentId: agent.agentId,
      bugId: bug.id,
    });

    return { status: 201 as const, verdict };
  });
}
