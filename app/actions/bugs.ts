"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  resolveSessionUserId,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/session-user";
import {
  commentSchema,
  createBugSchema,
  updateBugSchema,
} from "@/lib/validations/bug";

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
  const parsed = createBugSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity") || "medium",
    assigneeId: formData.get("assigneeId") || "",
    proofLinks: formData.get("proofLinks") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const assigneeId =
    parsed.data.assigneeId && parsed.data.assigneeId.length > 0
      ? parsed.data.assigneeId
      : null;

  const bug = await prisma.bug.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity,
      proofLinks: parsed.data.proofLinks,
      reporterId: userId,
      assigneeId,
    },
  });

  revalidatePath("/bugs");
  redirect(`/bugs/${bug.id}`);
}

export async function updateBugAction(
  bugId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUserId();

  const assigneeRaw = formData.get("assigneeId");
  const parsed = updateBugSchema.safeParse({
    status: formData.get("status") || undefined,
    severity: formData.get("severity") || undefined,
    assigneeId:
      assigneeRaw === "" || assigneeRaw === "unassigned"
        ? null
        : assigneeRaw || undefined,
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
  if (parsed.data.severity) data.severity = parsed.data.severity;
  if (parsed.data.assigneeId !== undefined) {
    data.assigneeId =
      parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
  }

  await prisma.bug.update({
    where: { id: bugId },
    data,
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }

  await prisma.comment.create({
    data: {
      bugId,
      authorId: userId,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/bugs/${bugId}`);
  return { ok: true };
}

export type ToggleVoteResult = ActionResult & {
  voted?: boolean;
  voteCount?: number;
};

export async function toggleVoteAction(
  bugId: string,
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

    if (existing) {
      await tx.vote.delete({ where: { id: existing.id } });
      const updated = await tx.bug.update({
        where: { id: bugId },
        data: { voteCount: { decrement: 1 } },
        select: { voteCount: true },
      });
      return { voted: false, voteCount: Math.max(0, updated.voteCount) };
    }

    await tx.vote.create({ data: { userId, bugId } });
    const updated = await tx.bug.update({
      where: { id: bugId },
      data: { voteCount: { increment: 1 } },
      select: { voteCount: true },
    });
    return { voted: true, voteCount: updated.voteCount };
  });

  // Keep denormalized count non-negative if a race ever undershoots.
  if (result.voteCount < 0) {
    await prisma.bug.update({
      where: { id: bugId },
      data: { voteCount: 0 },
    });
    result.voteCount = 0;
  }

  revalidatePath("/bugs");
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true, ...result };
}
