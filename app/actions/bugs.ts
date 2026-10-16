"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activityCreateData,
  assigneeChangedSummary,
  commentedSummary,
  createdSummary,
  severityChangedSummary,
  statusChangedSummary,
  type ActivityMetadata,
} from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import {
  resolveSessionUserId,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/session-user";
import {
  MAX_COMMENT_DEPTH,
  commentDepth,
} from "@/lib/comments";
import {
  commentSchema,
  createBugSchema,
  updateBugSchema,
} from "@/lib/validations/bug";
import { calculateVoteChange } from "@/lib/voting";
import type { ActivityType, Prisma } from "@prisma/client";


export type ActionResult = { error?: string; ok?: boolean };

/** Redirects to login when the JWT is missing or no longer maps to a User row. */
async function requireUserId() {
  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    redirect("/login");
  }
  return resolved.userId;
}

export async function createBugAction(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const admin = isAdmin(creator?.role);

  // Non-admins cannot set severity/assignee at creation.
  const parsed = createBugSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    severity: admin ? formData.get("severity") || "medium" : "medium",
    assigneeId: admin ? formData.get("assigneeId") || "" : "",
    proofLinks: formData.get("proofLinks") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const assigneeId =
    admin && parsed.data.assigneeId && parsed.data.assigneeId.length > 0
      ? parsed.data.assigneeId
      : null;

  // Always open at creation — createBugSchema rejects client status.
  const bug = await prisma.bug.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      severity: admin ? parsed.data.severity : "medium",
      status: "open",
      proofLinks: parsed.data.proofLinks,
      reporterId: userId,
      assigneeId,
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

  revalidatePath("/bugs");
  redirect(`/bugs/${bug.id}`);
}

export async function updateBugAction(
  bugId: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const admin = isAdmin(user?.role);

  const existing = await prisma.bug.findUnique({
    where: { id: bugId },
    include: { assignee: { select: { id: true, name: true } } },
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
  const parsed = updateBugSchema.safeParse({
    status: formData.get("status") || undefined,
    severity: admin ? formData.get("severity") || undefined : undefined,
    assigneeId: admin
      ? assigneeRaw === "" || assigneeRaw === "unassigned"
        ? null
        : assigneeRaw || undefined
      : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data: {
    status?: typeof parsed.data.status;
    severity?: typeof parsed.data.severity;
    assigneeId?: string | null;
  } = {};

  if (parsed.data.status) data.status = parsed.data.status;
  if (admin) {
    if (parsed.data.severity) data.severity = parsed.data.severity;
    if (parsed.data.assigneeId !== undefined) {
      data.assigneeId =
        parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
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
      toName = nextAssignee?.name ?? null;
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

  if (pending.length === 0 && Object.keys(data).length === 0) {
    return { ok: true };
  }

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

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true };
}

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

  await prisma.$transaction(async (tx) => {
    await tx.comment.create({
      data: {
        bugId,
        authorId: userId,
        body: parsed.data.body,
        parentId: parentId ?? null,
      },
    });
    await tx.bugActivity.create({
      data: {
        bugId,
        actorId: userId,
        type: "commented",
        summary: commentedSummary(parsed.data.body),
        metadata: {
          field: "comment",
          commentPreview: parsed.data.body.slice(0, 120),
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
};

export async function toggleVoteAction(
  bugId: string,
  direction: 1 | -1 = 1,
): Promise<ToggleVoteResult> {
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

    return {
      voted: nextVote === 1,
      userVote: nextVote,
      voteCount,
    };
  });

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true, ...result };
}

