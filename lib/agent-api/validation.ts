import { Prisma, type PrismaClient, type Severity, type ValidationKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { reviewerConflict, type ReviewedBug } from "@/lib/agents/independence";
import { hasLevel } from "@/lib/agents/levels";
import type { AgentContext } from "@/lib/agents/require-agent";
import { award } from "@/lib/points/award";
import { pointSourceKey, REPORTER_POINTS } from "@/lib/points/rules";
import { severities } from "@/lib/validations/issue";

/**
 * Reviewer agents validating issues (#433). A validation says whether an
 * issue is a real bug, whether its report is well formed, whether it is a
 * duplicate, or whether its fix holds up.
 *
 * - Only `reviewer` and `merger` agents may validate.
 * - The agent that filed the issue may not, and neither may any agent that
 *   fails `assertIndependentReviewer` (#442): same owner as the filer, the
 *   issue's own beneficiary, or the owner of the agent holding the claim.
 * - One validation per agent, issue and kind.
 * - Accepting kind `real` sets the issue's severity. It is the only agent
 *   path that does, so it is required there.
 * - An issue is confirmed once two independent reviewers, with different
 *   owners, have accepted it as real. When that first happens the reporter
 *   earns their points through `award()` (#428), once.
 */

export const VALIDATION_KINDS = ["real", "format", "duplicate", "fix"] as const satisfies readonly ValidationKind[];
export const VALIDATION_VERDICTS = ["accept", "reject"] as const;
/** How many independent accepts of `real` confirm an issue. */
export const CONFIRMATIONS_NEEDED = 2;
export const VALIDATION_NOTES_MAX = 2000;

export const validationBodySchema = z
  .object({
    kind: z.enum(VALIDATION_KINDS),
    verdict: z.enum(VALIDATION_VERDICTS),
    notes: z.string().trim().max(VALIDATION_NOTES_MAX).optional(),
    /** The person the agent acts for; defaults to its owner. */
    onBehalfOfUserId: z.string().trim().min(1).max(191).optional(),
    severity: z.enum(severities).optional(),
    /** For a duplicate verdict: the canonical issue. */
    duplicateOfId: z.string().trim().min(1).max(191).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.kind === "real" && body.verdict === "accept" && !body.severity) {
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Accepting an issue as real sets its severity: send low, medium, high or critical.",
      });
    }
    if (body.severity && !(body.kind === "real" && body.verdict === "accept")) {
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Severity is only set when accepting an issue as real.",
      });
    }
    if (body.duplicateOfId && body.kind !== "duplicate") {
      ctx.addIssue({
        code: "custom",
        path: ["duplicateOfId"],
        message: "duplicateOfId only goes with kind duplicate.",
      });
    }
  });

export type ValidationBody = z.infer<typeof validationBodySchema>;

type Db = PrismaClient | Prisma.TransactionClient;

/** What the independence rule and the confirmation count need about an issue. */
const reviewedBugSelect = {
  id: true,
  tenantId: true,
  severity: true,
  reporterId: true,
  beneficiaryUserId: true,
  duplicateOfId: true,
  createdByAgentId: true,
  createdByAgent: { select: { ownerUserId: true } },
  claims: { select: { status: true, releasedAt: true, agent: { select: { ownerUserId: true } } } },
} satisfies Prisma.BugSelect;

type LoadedBug = Prisma.BugGetPayload<{ select: typeof reviewedBugSelect }>;

/** Accepts of kind `real` that count toward confirming `bug`. */
async function countedConfirmations(db: Db, bug: LoadedBug): Promise<number> {
  const accepts = await db.issueValidation.findMany({
    where: { bugId: bug.id, kind: "real", verdict: "accept" },
    select: {
      id: true,
      agentId: true,
      agent: { select: { id: true, ownerUserId: true } },
    },
  });
  // A validation that has been undone no longer counts toward confirmation (#450).
  const undone = await db.agentAuditEvent.findMany({
    where: {
      tenantId: bug.tenantId,
      action: "issue.validated",
      bugId: bug.id,
      undoneAt: { not: null },
    },
    select: { payload: true },
  });
  const undoneValidationIds = new Set(
    (undone as Array<{ payload: { validationId?: string } | null }>).map(
      (e) => e.payload?.validationId,
    ).filter(Boolean),
  );
  const reviewed: ReviewedBug = bug;
  const owners = new Set<string>();
  for (const { id, agent } of accepts) {
    // Checked again now, not only when submitted: a claim taken since can
    // make an earlier reviewer no longer independent.
    if (agent.id === bug.createdByAgentId) continue;
    if (reviewerConflict({ id: agent.id, ownerUserId: agent.ownerUserId }, reviewed)) continue;
    // An undone validation no longer counts toward confirming the issue.
    if (undoneValidationIds.has(id)) continue;
    owners.add(agent.ownerUserId);
  }
  return owners.size;
}

/** True once two independent reviewers have accepted the issue as real (#434 uses this). */
export async function isConfirmed(bugId: string, db: Db = prisma): Promise<boolean> {
  const bug = await db.bug.findUnique({ where: { id: bugId }, select: reviewedBugSelect });
  if (!bug) return false;
  return (await countedConfirmations(db, bug)) >= CONFIRMATIONS_NEEDED;
}

/** Duplicates earn the reporter nothing (#422). */
async function isDuplicate(db: Db, bug: LoadedBug): Promise<boolean> {
  if (bug.duplicateOfId) return true;
  const accepted = await db.issueValidation.count({
    where: { bugId: bug.id, kind: "duplicate", verdict: "accept" },
  });
  return accepted > 0;
}

export type SubmitValidationResult =
  | {
      status: 201;
      validation: {
        id: string;
        kind: ValidationKind;
        verdict: "accept" | "reject";
        severity: Severity | null;
        duplicateOfId: string | null;
        onBehalfOfUserId: string;
      };
      confirmed: boolean;
      /** True when this validation is the one that confirmed the issue. */
      newlyConfirmed: boolean;
    }
  | { status: 400; error: "invalid_request"; message: string; field?: string }
  | { status: 403; error: "insufficient_level" | "creator_cannot_validate" | "not_independent"; message: string }
  | { status: 404; error: "not_found"; message: string }
  | { status: 409; error: "already_validated"; message: string };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function submitValidation(
  agent: AgentContext,
  bugId: string,
  rawBody: unknown,
): Promise<SubmitValidationResult> {
  if (!hasLevel(agent.level, "reviewer")) {
    return {
      status: 403,
      error: "insufficient_level",
      message: "Only reviewer or merger agents can validate issues.",
    };
  }

  const parsed = validationBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 400,
      error: "invalid_request",
      message: issue?.message ?? "Invalid validation.",
      field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
    };
  }
  const body = parsed.data;

  const bug = await prisma.bug.findFirst({
    where: { id: bugId, tenantId: agent.tenantId, isDeleted: false },
    select: reviewedBugSelect,
  });
  if (!bug) return { status: 404, error: "not_found", message: "No such issue in this agent's tenant." };

  if (bug.createdByAgentId === agent.agentId) {
    return {
      status: 403,
      error: "creator_cannot_validate",
      message: "The agent that filed an issue can't validate it.",
    };
  }
  const conflict = reviewerConflict({ id: agent.agentId, ownerUserId: agent.ownerId }, bug);
  if (conflict) {
    return {
      status: 403,
      error: "not_independent",
      message:
        conflict === "own-ticket"
          ? "This issue is for the agent's owner, so this agent can't validate it."
          : conflict === "created-by-own-agent"
            ? "An agent of the same owner filed this issue, so this agent can't validate it."
            : "An agent of the same owner is working on this issue, so this agent can't validate it.",
    };
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

  if (body.duplicateOfId) {
    const canonical =
      body.duplicateOfId === bug.id
        ? null
        : await prisma.bug.findFirst({
            where: { id: body.duplicateOfId, tenantId: agent.tenantId, isDeleted: false },
            select: { id: true },
          });
    if (!canonical) {
      return {
        status: 400,
        error: "invalid_request",
        message: "duplicateOfId must be another issue in this tenant.",
        field: "duplicateOfId",
      };
    }
  }

  const setsSeverity = body.kind === "real" && body.verdict === "accept" ? body.severity! : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const wasConfirmed = (await countedConfirmations(tx, bug)) >= CONFIRMATIONS_NEEDED;

      const validation = await tx.issueValidation.create({
        data: {
          bugId: bug.id,
          agentId: agent.agentId,
          onBehalfOfUserId,
          kind: body.kind,
          verdict: body.verdict,
          notes: body.notes || null,
          duplicateOfId: body.duplicateOfId ?? null,
          severity: setsSeverity,
          previousSeverity: setsSeverity ? bug.severity : null,
        },
        select: { id: true, kind: true, verdict: true, severity: true, duplicateOfId: true, onBehalfOfUserId: true },
      });
      if (setsSeverity && setsSeverity !== bug.severity) {
        await tx.bug.update({ where: { id: bug.id }, data: { severity: setsSeverity } });
      }

      const confirmed = (await countedConfirmations(tx, bug)) >= CONFIRMATIONS_NEEDED;
      const newlyConfirmed = confirmed && !wasConfirmed;
      if (newlyConfirmed && !(await isDuplicate(tx, bug))) {
        // The person the issue is for earns the reporter points (#422), once:
        // the sourceKey makes a second award, or the backfill (#435), a no-op.
        const userId = bug.beneficiaryUserId ?? bug.reporterId;
        await award(tx, {
          tenantId: bug.tenantId,
          userId,
          bugId: bug.id,
          role: "reporter",
          points: REPORTER_POINTS,
          sourceKey: pointSourceKey("reporter", bug.id, userId),
        });
      }

      await audit(
        agent,
        "issue.validated",
        `bug:${bug.id}`,
        {
          validationId: validation.id,
          kind: body.kind,
          verdict: body.verdict,
          onBehalfOfUserId,
          ...(setsSeverity ? { severity: setsSeverity, previousSeverity: bug.severity } : {}),
          ...(body.duplicateOfId ? { duplicateOfId: body.duplicateOfId } : {}),
          ...(newlyConfirmed ? { confirmed: true } : {}),
        },
        { bugId: bug.id, db: tx },
      );
      // TODO(#445): publish an "issue.validated" event here once
      // lib/agent-api/events.ts exists.

      return { status: 201 as const, validation, confirmed, newlyConfirmed };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return {
      status: 409,
      error: "already_validated",
      message: `This agent has already submitted a ${body.kind} validation for this issue.`,
    };
  }
}
