import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "attachment"> | Pick<Prisma.TransactionClient, "attachment">;

/**
 * Links freshly uploaded files to the issue (and comment) being saved (#215).
 * Only the uploader's own, not-yet-linked files can be claimed, so nobody can
 * attach - or steal - someone else's upload by guessing its id.
 */
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
