"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activityCreateData,
  assigneeChangedSummary,
  commentedSummary,
  commentPreview,
  createdSummary,
  severityChangedSummary,
  statusChangedSummary,
  type ActivityMetadata,
} from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/auth-helpers";
import {
  resolveSessionUserId,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/session-user";
import { MAX_COMMENT_DEPTH, commentDepth } from "@/lib/comments";
import {
  extractMentionedUserIds,
  normalizeMentions,
} from "@/lib/mentions";
import {
  commentSchema,
  createBugSchema,
  updateBugSchema,
} from "@/lib/validations/bug";
import { calculateVoteChange, isValidVoteDirection } from "@/lib/voting";
import { canDeleteTicket, TICKET_DELETION_ERRORS } from "@/lib/ticket-deletion";
import { Prisma, type ActivityType } from "@prisma/client";

export type ActionResult = { error?: string; ok?: boolean };

/**
 * Resolves `@[Name](userId)` tags against real accounts: known ids are
 * rewritten to the current name, unknown ids degrade to plain `@Name`.
 */
async function normalizeMentionTags(text: string): Promise<string> {
  const mentionedIds = extractMentionedUserIds(text);
  if (mentionedIds.length === 0) return text;

  const validUsers = await prisma.user.findMany({
    where: { id: { in: mentionedIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(validUsers.map((user) => [user.id, user.name]));
  return normalizeMentions(text, userMap);
}

/** Redirects to login when the JWT is missing or no longer maps to a User row. */
async function requireUserId() {
  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    redirect("/login");
  }
  return resolved.userId;
}

/** Creates a bug as the signed-in user; only admins may set severity/assignee. */
export async function createBugAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const userId = user.id;
  const admin = isAdmin(user.role);

  // Non-admins cannot set severity/assignee at creation.
  const parsed = createBugSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    severity: admin ? formData.get("severity") || "medium" : "medium",
    typeId: formData.get("typeId") || "",
    assigneeId: admin ? formData.get("assigneeId") || "" : "",
    categoryId: formData.get("categoryId") || "",
    proofLinks: formData.get("proofLinks") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const assigneeId =
    admin && parsed.data.assigneeId && parsed.data.assigneeId.length > 0
      ? parsed.data.assigneeId
      : null;

  const typeId =
    parsed.data.typeId && parsed.data.typeId.length > 0
      ? parsed.data.typeId
      : null;

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!assignee) {
      return { error: "Assignee not found" };
    }
  }

  const description = await normalizeMentionTags(parsed.data.description);

  const categoryId =
    parsed.data.categoryId && parsed.data.categoryId.length > 0
      ? parsed.data.categoryId
      : null;

  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      return { error: "Category not found or inactive" };
    }
  }

  // Always open at creation — createBugSchema rejects client status.
  let bug;
  try {
    bug = await prisma.bug.create({
      data: {
        title: parsed.data.title,
        description,
        severity: admin ? parsed.data.severity : "medium",
        status: "open",
        typeId,
        proofLinks: parsed.data.proofLinks,
        reporterId: userId,
        assigneeId,
        categoryId,
        activities: {
          create: {
            actorId: userId,
            type: "created",
            summary: createdSummary(parsed.data.title),
            metadata: {
              field: "title",
              to: parsed.data.title,
            } as Prisma.InputJsonValue,
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { error: "Assignee not found" };
    }
    throw error;
  }

  revalidatePath("/bugs");
  redirect(`/bugs/${bug.id}`);
}

/** Updates status (assignee/admin) and severity/assignee (admin) and logs activity. */
export async function updateBugAction(
  bugId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const userId = user.id;
  const admin = isAdmin(user.role);

  const existing = await prisma.bug.findUnique({
    where: { id: bugId },
    include: {
      assignee: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  if (!existing) {
    return { error: "Bug not found" };
  }

  const isAssignee = existing.assigneeId === userId;
  if (!admin && !isAssignee) {
    return {
      error: "Only the assignee or an admin can update this bug",
    };
  }

  const assigneeRaw = formData.get("assigneeId");
  const categoryRaw = formData.get("categoryId");
  const typeRaw = formData.get("typeId");
  const parsed = updateBugSchema.safeParse({
    status: formData.get("status") || undefined,
    severity: admin ? formData.get("severity") || undefined : undefined,
    typeId: admin
      ? typeRaw === "" || typeRaw === "none"
        ? null
        : typeRaw || undefined
      : undefined,
    assigneeId: admin
      ? assigneeRaw === "" || assigneeRaw === "unassigned"
        ? null
        : assigneeRaw || undefined
      : undefined,
    categoryId: admin
      ? categoryRaw === "" || categoryRaw === "none"
        ? null
        : categoryRaw || undefined
      : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data: {
    status?: typeof parsed.data.status;
    severity?: typeof parsed.data.severity;
    typeId?: string | null;
    assigneeId?: string | null;
    categoryId?: string | null;
  } = {};

  if (parsed.data.status) data.status = parsed.data.status;
  if (admin) {
    if (parsed.data.severity) data.severity = parsed.data.severity;
    if (parsed.data.typeId !== undefined) {
      data.typeId = parsed.data.typeId === "" ? null : parsed.data.typeId;
    }
    if (parsed.data.assigneeId !== undefined) {
      data.assigneeId =
        parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
    }
    if (parsed.data.categoryId !== undefined) {
      data.categoryId =
        parsed.data.categoryId === "" ? null : parsed.data.categoryId;
    }
  }

  type PendingActivity = {
    type: ActivityType;
    summary: string;
    metadata?: ActivityMetadata;
  };
  const pending: PendingActivity[] = [];

  if (data.status && data.status !== existing.status) {
    pending.push({
      type: "status_changed",
      summary: statusChangedSummary(existing.status, data.status),
      metadata: {
        field: "status",
        from: existing.status,
        to: data.status,
      },
    });
  }

  if (data.severity && data.severity !== existing.severity) {
    pending.push({
      type: "severity_changed",
      summary: severityChangedSummary(existing.severity, data.severity),
      metadata: {
        field: "severity",
        from: existing.severity,
        to: data.severity,
      },
    });
  }

  if (
    data.assigneeId !== undefined &&
    data.assigneeId !== existing.assigneeId
  ) {
    let toName: string | null = null;
    if (data.assigneeId) {
      const nextAssignee = await prisma.user.findUnique({
        where: { id: data.assigneeId },
        select: { name: true },
      });
      if (!nextAssignee) {
        return { error: "Assignee not found" };
      }
      toName = nextAssignee.name ?? null;
    }
    pending.push({
      type: "assignee_changed",
      summary: assigneeChangedSummary(existing.assignee?.name ?? null, toName),
      metadata: {
        field: "assigneeId",
        from: existing.assigneeId,
        to: data.assigneeId,
      },
    });
  }

  if (data.categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!cat) {
      return { error: "Category not found" };
    }
  }

  if (pending.length === 0 && Object.keys(data).length === 0) {
    return { ok: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.bug.update({
          where: { id: bugId },
          data,
        });
      }
      if (pending.length > 0) {
        await tx.bugActivity.createMany({
          data: activityCreateData(
            pending.map((entry) => ({
              bugId,
              actorId: userId,
              ...entry,
            })),
          ),
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { error: "Assignee not found" };
    }
    throw error;
  }

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true };
}

/** Adds a (possibly threaded) comment to a bug and records the activity. */
export async function addCommentAction(
  bugId: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = commentSchema.safeParse({
    body: formData.get("body"),
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }

  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true },
  });
  if (!bug) {
    return { error: "Bug not found" };
  }

  const parentId = parsed.data.parentId;

  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, bugId: true, parentId: true },
    });

    if (!parent || parent.bugId !== bugId) {
      return { error: "Parent comment not found on this ticket" };
    }

    const threadComments = await prisma.comment.findMany({
      where: { bugId },
      select: { id: true, parentId: true },
    });
    const parentById = new Map(
      threadComments.map((c) => [c.id, c.parentId] as const),
    );
    const parentDepth = commentDepth(parent.id, parentById);

    if (parentDepth >= MAX_COMMENT_DEPTH) {
      return {
        error: `Replies are limited to ${MAX_COMMENT_DEPTH} levels of nesting`,
      };
    }
  }

  const normalizedBody = await normalizeMentionTags(parsed.data.body);

  await prisma.$transaction(async (tx) => {
    await tx.comment.create({
      data: {
        bugId,
        authorId: userId,
        body: normalizedBody,
        parentId: parentId ?? null,
      },
    });
    await tx.bugActivity.create({
      data: {
        bugId,
        actorId: userId,
        type: "commented",
        summary: commentedSummary(normalizedBody),
        metadata: {
          field: "comment",
          commentPreview: commentPreview(normalizedBody),
        } as Prisma.InputJsonValue,
      },
    });
    await tx.bug.update({
      where: { id: bugId },
      data: { updatedAt: new Date() },
    });
  });

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true };
}

export type ToggleVoteResult = ActionResult & {
  voted?: boolean;
  userVote?: number;
  voteCount?: number;
  likeCount?: number;
  dislikeCount?: number;
};

/** Toggles the current user's reaction on a bug; rejects any direction other than 1 or -1. */
export async function toggleVoteAction(
  bugId: string,
  direction: unknown = 1,
): Promise<ToggleVoteResult> {
  if (!isValidVoteDirection(direction)) {
    return { error: "Invalid vote" };
  }

  // Do not redirect here — VoteButton needs a clear error for stale JWTs
  // after a DB reseed (old cuid no longer exists → Vote_userId_fkey).
  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    return { error: SESSION_EXPIRED_MESSAGE };
  }
  const { userId } = resolved;

  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true },
  });
  if (!bug) {
    return { error: "Bug not found" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.vote.findUnique({
      where: { userId_bugId: { userId, bugId } },
    });

    const currentVote = existing?.value ?? 0;
    const { nextVote, countDelta } = calculateVoteChange(currentVote, direction);

    if (nextVote === 0 && existing) {
      await tx.vote.delete({ where: { id: existing.id } });
    } else if (existing) {
      await tx.vote.update({
        where: { id: existing.id },
        data: { value: nextVote },
      });
    } else {
      await tx.vote.create({
        data: { userId, bugId, value: nextVote },
      });
    }

    const rows = await tx.$queryRaw<Array<{ voteCount: number }>>`
      UPDATE "Bug"
      SET "voteCount" = "voteCount" + ${countDelta}
      WHERE "id" = ${bugId}
      RETURNING "voteCount"
    `;

    const voteCount = rows[0]?.voteCount ?? 0;

    const voteCounts = await tx.vote.groupBy({
      by: ["value"],
      where: { bugId },
      _count: { _all: true },
    });

    let likeCount = 0;
    let dislikeCount = 0;
    for (const c of voteCounts) {
      if (c.value === 1) likeCount = c._count._all;
      if (c.value === -1) dislikeCount = c._count._all;
    }

    return {
      voted: nextVote === 1,
      userVote: nextVote,
      voteCount,
      likeCount,
      dislikeCount,
    };
  });

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true, ...result };
}

/**
 * Permanently deletes a bug and all its dependent data (comments, votes, activity).
 * Super admins only.
 */
export async function deleteBugAction(bugId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canDeleteTicket(user.role)) {
    return { error: TICKET_DELETION_ERRORS.unauthorized };
  }

  if (!bugId || typeof bugId !== "string" || bugId.trim().length === 0) {
    return { error: TICKET_DELETION_ERRORS.invalidId };
  }

  const existing = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true },
  });

  if (!existing) {
    return { error: TICKET_DELETION_ERRORS.notFound };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { bugId } });
      await tx.vote.deleteMany({ where: { bugId } });
      await tx.bugActivity.deleteMany({ where: { bugId } });
      await tx.bug.delete({ where: { id: bugId } });
    });
  } catch (error) {
    console.error("Failed to delete bug:", error);
    return { error: TICKET_DELETION_ERRORS.failed };
  }

  revalidatePath("/bugs");
  redirect("/bugs");
}

