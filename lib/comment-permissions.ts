import { isAdmin, type AppRole } from "@/lib/roles";

export const COMMENT_ERRORS = {
  notFound: "Comment not found",
  deleted: "This comment was deleted",
  issueDeleted: "Issue not found",
  notAuthor: "Only the author can edit this comment",
  cannotDelete: "Only the author or an admin can delete this comment",
  replyToDeleted: "You can't reply to a deleted comment",
  failed: "Could not update the comment. Please try again.",
} as const;

type CommentLike = { authorId: string; deletedAt?: Date | string | null };

/** Only the author may edit, and never a deleted comment (#150). */
export function canEditComment(actorId: string | undefined, comment: CommentLike): boolean {
  return Boolean(actorId) && !comment.deletedAt && comment.authorId === actorId;
}

/** The author or an admin/super admin may delete a comment that isn't already deleted. */
export function canDeleteComment(
  actorId: string | undefined,
  actorRole: AppRole | null | undefined,
  comment: CommentLike,
): boolean {
  if (!actorId || comment.deletedAt) return false;
  return comment.authorId === actorId || isAdmin(actorRole);
}
