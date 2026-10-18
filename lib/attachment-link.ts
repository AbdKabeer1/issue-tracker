import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "attachment"> | Pick<Prisma.TransactionClient, "attachment">;

/**
 * Links freshly uploaded files to the issue (and comment) being saved (#215).
 * Only the uploader's own, not-yet-linked files can be claimed, so nobody can
 * attach - or steal - someone else's upload by guessing its id.
 */
/** Most files one description or comment links by reference. */
export const MAX_REFERENCED_ATTACHMENTS = 20;

/**
 * Attachment ids referenced from Markdown as `/api/attachments/<id>`, for
 * images pasted or dropped into the editor (#305). Linking them on save is
 * what lets other readers see them; until then only the uploader can.
 */
export function attachmentIdsInMarkdown(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = [...text.matchAll(/\/api\/attachments\/([a-z0-9]{8,40})\b/gi)].map((m) => m[1]);
  return [...new Set(ids)].slice(0, MAX_REFERENCED_ATTACHMENTS);
}

export async function linkAttachments(
  db: Db,
  {
    ids,
    uploaderId,
    bugId,
    commentId = null,
  }: { ids: string[]; uploaderId: string; bugId: string; commentId?: string | null },
): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await db.attachment.updateMany({
    where: { id: { in: ids }, uploaderId, bugId: null, commentId: null },
    data: { bugId, commentId },
  });
  return result.count;
}
