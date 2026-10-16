"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { commentSchema } from "@/lib/validations/bug";
import {
  extractMentionedUserIds,
  normalizeMentions,
} from "@/lib/mentions";
import {
  canDeleteComment,
  canEditComment,
  COMMENT_ERRORS,
} from "@/lib/comment-permissions";
import { commentDeletedSummary } from "@/lib/activity-log";

export type CommentActionResult = { error?: string; ok?: boolean };

async function loadComment(commentId: unknown) {
  if (typeof commentId !== "string" || commentId.trim().length === 0) return null;
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      bugId: true,
      authorId: true,
      deletedAt: true,
      author: { select: { name: true } },
      bug: { select: { isDeleted: true } },
    },
  });
}

/** Edit a comment's body. Authors only; mentions are re-verified (#150). */
export async function updateCommentAction(
  commentId: string,
  formData: FormData,
): Promise<CommentActionResult> {
  const user = await requireUser();
  const comment = await loadComment(commentId);
  if (!comment) return { error: COMMENT_ERRORS.notFound };
  if (comment.bug.isDeleted) return { error: COMMENT_ERRORS.issueDeleted };
  if (comment.deletedAt) return { error: COMMENT_ERRORS.deleted };
  if (!canEditComment(user.id, comment)) return { error: COMMENT_ERRORS.notAuthor };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }

  const mentionedIds = extractMentionedUserIds(parsed.data.body);
  const known = mentionedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: mentionedIds } },
        select: { id: true, name: true },
      })
    : [];
  const body = normalizeMentions(
    parsed.data.body,
    new Map(known.map((u) => [u.id, u.name])),
  );

  await prisma.comment.update({
    where: { id: comment.id },
    data: { body, editedAt: new Date() },
  });

  revalidatePath(`/bugs/${comment.bugId}`);
  return { ok: true };
}

/**
 * Soft-delete a comment: the body is cleared, replies stay in place and the
 * thread shows "This comment was deleted". Authors and admins only. When an
 * admin removes someone else's comment it is logged in the activity timeline,
 * and the comment's text is removed from the "added a comment" log entry.
 */
export async function deleteCommentAction(
  commentId: string,
): Promise<CommentActionResult> {
  const user = await requireUser();
  const comment = await loadComment(commentId);
  if (!comment) return { error: COMMENT_ERRORS.notFound };
  if (comment.bug.isDeleted) return { error: COMMENT_ERRORS.issueDeleted };
  if (comment.deletedAt) return { error: COMMENT_ERRORS.deleted };
  if (!canDeleteComment(user.id, user.role, comment)) {
    return { error: COMMENT_ERRORS.cannotDelete };
  }

  const isModeration = comment.authorId !== user.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: comment.id },
        data: { body: "", deletedAt: new Date() },
      });

      // Scrub the text preview from the activity entry that recorded it.
      await tx.bugActivity.updateMany({
        where: {
          bugId: comment.bugId,
          type: "commented",
          metadata: { path: ["commentId"], equals: comment.id },
        },
        data: {
          summary: "added a comment (since deleted)",
          metadata: { field: "comment", commentId: comment.id } as Prisma.InputJsonValue,
        },
      });

      if (isModeration) {
        await tx.bugActivity.create({
          data: {
            bugId: comment.bugId,
            actorId: user.id,
            type: "comment_deleted",
            summary: commentDeletedSummary(comment.author.name),
            metadata: { field: "comment", commentId: comment.id } as Prisma.InputJsonValue,
          },
        });
      }
    });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return { error: COMMENT_ERRORS.failed };
  }

  revalidatePath(`/bugs/${comment.bugId}`);
  return { ok: true };
}
