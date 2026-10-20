import type { Prisma, PrismaClient } from "@prisma/client";
import { CONFIRMATIONS_NEEDED } from "@/lib/agent-api/validation";
import { reviewerConflict, type ReviewedBug } from "@/lib/agents/independence";
import { WORK_READINESS_VOTE_THRESHOLD } from "@/lib/ticket-assignment";

/** Where an open issue sits before someone starts the work. Not a status. */
export type IssueStage = "reported" | "confirmed" | "ready";

/** Sidebar views. Ready stays a tag: it is the same gate as assigning work. */
export type IssueStageView = "reported" | "confirmed";

export const issueStageLabels: Record<IssueStage, string> = {
  reported: "Reported",
  confirmed: "Confirmed",
  ready: "Ready",
};

export function parseIssueStageView(raw: string | null | undefined): IssueStageView | null {
  return raw === "reported" || raw === "confirmed" ? raw : null;
}

/**
 * Reported: open, and not yet confirmed. That includes issues a person filed
 * and issues an agent filed.
 * Confirmed: two independent reviewers accepted it, and it has fewer than
 * three upvotes.
 * Ready: confirmed and at least three upvotes. Same gate as taking the work.
 * Anything no longer open has no intake tag.
 */
export function issueStage(input: {
  status: string;
  voteCount: number;
  confirmed: boolean;
}): IssueStage | null {
  if (input.status !== "open") return null;
  if (!input.confirmed) return "reported";
  if (input.voteCount < WORK_READINESS_VOTE_THRESHOLD) return "confirmed";
  return "ready";
}

type AcceptingReview = { id: string; agentId: string; ownerUserId: string };

/** Distinct independent owners who accepted the issue as real. */
export function confirmationCount(input: {
  createdByAgentId: string | null;
  accepts: readonly AcceptingReview[];
  undoneIds: ReadonlySet<string>;
  bug: ReviewedBug;
}): number {
  const owners = new Set<string>();
  for (const accept of input.accepts) {
    if (input.createdByAgentId && accept.agentId === input.createdByAgentId) continue;
    if (input.undoneIds.has(accept.id)) continue;
    if (reviewerConflict({ id: accept.agentId, ownerUserId: accept.ownerUserId }, input.bug)) continue;
    owners.add(accept.ownerUserId);
  }
  return owners.size;
}

export function isConfirmedCount(count: number): boolean {
  return count >= CONFIRMATIONS_NEEDED;
}

/**
 * Stage of every open issue matching `where`. A missing validation table
 * leaves the map empty so the list still renders.
 */
export async function openIssueStages(
  db: PrismaClient,
  where: Prisma.BugWhereInput,
): Promise<Map<string, IssueStage>> {
  const bugs = await db.bug.findMany({
    where: { ...where, status: "open", isDeleted: false },
    select: {
      id: true,
      status: true,
      voteCount: true,
      beneficiaryUserId: true,
      reporterId: true,
      createdByAgentId: true,
      createdByAgent: { select: { ownerUserId: true } },
      claims: {
        where: { status: "active", releasedAt: null },
        select: { status: true, releasedAt: true, agent: { select: { ownerUserId: true } } },
      },
    },
  });
  const stages = new Map<string, IssueStage>();
  if (bugs.length === 0) return stages;

  const ids = bugs.map((bug) => bug.id);
  const [revisions, validations, undone] = await Promise.all([
    db.bugRevision.findMany({
      where: { bugId: { in: ids } },
      select: { bugId: true, editedAt: true },
    }),
    db.issueValidation.findMany({
      where: { bugId: { in: ids }, kind: "real", verdict: "accept" },
      select: {
        id: true,
        bugId: true,
        createdAt: true,
        agentId: true,
        agent: { select: { ownerUserId: true } },
      },
    }),
    db.agentAuditEvent.findMany({
      where: { action: "issue.validated", bugId: { in: ids }, undoneAt: { not: null } },
      select: { bugId: true, payload: true },
    }),
  ]);

  const revisedAt = new Map<string, Date>();
  for (const revision of revisions) {
    const current = revisedAt.get(revision.bugId);
    if (!current || revision.editedAt > current) revisedAt.set(revision.bugId, revision.editedAt);
  }
  const undoneByBug = new Map<string, Set<string>>();
  for (const event of undone) {
    const validationId = (event.payload as { validationId?: string } | null)?.validationId;
    if (!validationId) continue;
    const set = undoneByBug.get(event.bugId) ?? new Set<string>();
    set.add(validationId);
    undoneByBug.set(event.bugId, set);
  }
  const acceptsByBug = new Map<string, AcceptingReview[]>();
  for (const validation of validations) {
    const cutoff = revisedAt.get(validation.bugId);
    if (cutoff && validation.createdAt <= cutoff) continue;
    const list = acceptsByBug.get(validation.bugId) ?? [];
    list.push({
      id: validation.id,
      agentId: validation.agentId,
      ownerUserId: validation.agent.ownerUserId,
    });
    acceptsByBug.set(validation.bugId, list);
  }

  for (const bug of bugs) {
    const reviewed: ReviewedBug = {
      beneficiaryUserId: bug.beneficiaryUserId,
      reporterId: bug.reporterId,
      createdByAgent: bug.createdByAgent,
      claims: bug.claims,
    };
    const confirmed = isConfirmedCount(
      confirmationCount({
        createdByAgentId: bug.createdByAgentId,
        accepts: acceptsByBug.get(bug.id) ?? [],
        undoneIds: undoneByBug.get(bug.id) ?? new Set(),
        bug: reviewed,
      }),
    );
    const stage = issueStage({ status: bug.status, voteCount: bug.voteCount, confirmed });
    if (stage) stages.set(bug.id, stage);
  }
  return stages;
}
