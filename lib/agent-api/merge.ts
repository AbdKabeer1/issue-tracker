import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { reviewerConflict, type ReviewedBug } from "@/lib/agents/independence";
import { hasLevel } from "@/lib/agents/levels";
import type { AgentContext } from "@/lib/agents/require-agent";
import { IssueApiError } from "@/lib/agent-api/issues";
import { publish } from "@/lib/agent-api/events";
import { isConfirmed } from "@/lib/agent-api/validation";
import { award } from "@/lib/points/award";
import {
  MAX_REWARDED_REVIEWERS,
  pointSourceKey,
  REVIEWER_POINTS,
  solverPoints,
} from "@/lib/points/rules";
import { assertRedesignOpen } from "@/lib/redesigns";

/**
 * A merger accepting a fix (#434). The gate: the issue is confirmed, no
 * redesign is waiting for a person, and at least two reviewers whose owners
 * differ said the fix is good to merge. Neither the agent holding the claim
 * nor any agent of the claim holder's owner may be one of those reviewers.
 *
 * Accepting records the decision on Ziki: it sets the issue to `resolved` and
 * awards points through `award()` (#428) for the solver and for up to two
 * reviewers. It does not merge a git branch (#452).
 */

/** How many independent good-to-merge verdicts accept a fix. */
export const MERGE_VERDICTS_NEEDED = 2;

const mergeBugSelect = {
  id: true,
  tenantId: true,
  severity: true,
  status: true,
  assigneeId: true,
  beneficiaryUserId: true,
  reporterId: true,
  createdByAgentId: true,
  createdByAgent: { select: { ownerUserId: true } },
  claims: {
    select: {
      status: true,
      releasedAt: true,
      agentId: true,
      beneficiaryUserId: true,
      agent: { select: { ownerUserId: true } },
    },
  },
} satisfies Prisma.BugSelect;

type LoadedBug = Prisma.BugGetPayload<{ select: typeof mergeBugSelect }>;
type ActiveClaim = LoadedBug["claims"][number];

/** The claim an agent is currently working `bug` under (#432). */
function activeClaim(bug: LoadedBug): ActiveClaim | null {
  return bug.claims.find((c) => c.status === "active" && !c.releasedAt) ?? null;
}

export type AcceptFixResult =
  | {
      status: 200;
      accepted: true;
      solverUserId: string | null;
      rewardedReviewerUserIds: string[];
    }
  | { status: 403; error: "insufficient_level"; message: string }
  | { status: 404; error: "not_found"; message: string }
  | {
      status: 409;
      error: "not_ready";
      missing: "already_accepted" | "redesign" | "confirmation" | "verdicts";
      message: string;
    };

export async function acceptFix(agent: AgentContext, bugId: string): Promise<AcceptFixResult> {
  if (!hasLevel(agent.level, "merger")) {
    return { status: 403, error: "insufficient_level", message: "Only merger agents can accept a fix." };
  }

  const bug = await prisma.bug.findFirst({
    where: { id: bugId, tenantId: agent.tenantId, isDeleted: false },
    select: mergeBugSelect,
  });
  if (!bug) return { status: 404, error: "not_found", message: "No such issue in this agent's tenant." };
  if (bug.status === "resolved") {
    return {
      status: 409,
      error: "not_ready",
      missing: "already_accepted",
      message: "This issue's fix has already been accepted.",
    };
  }

  const claim = activeClaim(bug);
  const reviewed: ReviewedBug = bug;

  return prisma.$transaction(async (tx) => {
    try {
      await assertRedesignOpen(bug.id, tx);
    } catch (error) {
      if (error instanceof IssueApiError) {
        return {
          status: 409 as const,
          error: "not_ready" as const,
          missing: "redesign" as const,
          message: error.message,
        };
      }
      throw error;
    }

    if (!(await isConfirmed(bug.id, tx))) {
      return {
        status: 409 as const,
        error: "not_ready" as const,
        missing: "confirmation" as const,
        message: "This issue isn't confirmed yet: two independent reviewers must accept it as real.",
      };
    }

    const verdicts = await tx.testVerdict.findMany({
      where: { bugId: bug.id, goodToMerge: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, onBehalfOfUserId: true, agent: { select: { id: true, ownerUserId: true } } },
    });

    const owners = new Set<string>();
    const reviewers: string[] = [];
    for (const verdict of verdicts) {
      // Checked again now, not only when submitted: a claim taken since, or a
      // verdict from the claim holder's own side, no longer counts.
      if (claim && (verdict.agent.id === claim.agentId || verdict.agent.ownerUserId === claim.agent.ownerUserId)) {
        continue;
      }
      if (reviewerConflict({ id: verdict.agent.id, ownerUserId: verdict.agent.ownerUserId }, reviewed)) continue;
      if (owners.has(verdict.agent.ownerUserId)) continue;
      owners.add(verdict.agent.ownerUserId);
      reviewers.push(verdict.onBehalfOfUserId);
    }

    if (reviewers.length < MERGE_VERDICTS_NEEDED) {
      return {
        status: 409 as const,
        error: "not_ready" as const,
        missing: "verdicts" as const,
        message: `This needs ${MERGE_VERDICTS_NEEDED} reviewers saying it is good to merge; ${reviewers.length} count so far.`,
      };
    }

    const rewardedReviewerUserIds = reviewers.slice(0, MAX_REWARDED_REVIEWERS);
    const solverUserId = claim?.beneficiaryUserId ?? bug.assigneeId;

    await tx.bug.update({ where: { id: bug.id }, data: { status: "resolved" } });

    // The solver: the person the active claim is for, else whoever it is
    // assigned to. The sourceKey makes a second accept, or the backfill
    // (#435), a no-op.
    if (solverUserId) {
      await award(tx, {
        tenantId: bug.tenantId,
        userId: solverUserId,
        bugId: bug.id,
        role: "solver",
        points: solverPoints(bug.severity),
        sourceKey: pointSourceKey("solver", bug.id, solverUserId),
      });
    }
    for (const userId of rewardedReviewerUserIds) {
      await award(tx, {
        tenantId: bug.tenantId,
        userId,
        bugId: bug.id,
        role: "reviewer",
        points: REVIEWER_POINTS,
        sourceKey: pointSourceKey("reviewer", bug.id, userId),
      });
    }

    await audit(
      agent,
      "issue.accepted",
      `bug:${bug.id}`,
      { solverUserId, rewardedReviewerUserIds },
      { bugId: bug.id, db: tx },
    );
    await publish(tx, {
      tenantId: bug.tenantId,
      type: "issue.accepted",
      payload: { issueId: bug.id, solverUserId, rewardedReviewerUserIds, status: "resolved" },
      actorAgentId: agent.agentId,
      bugId: bug.id,
    });

    return { status: 200 as const, accepted: true as const, solverUserId, rewardedReviewerUserIds };
  });
}
