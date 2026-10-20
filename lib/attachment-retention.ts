import type { PrismaClient } from "@prisma/client";

/**
 * Uploads nobody ever attached are deleted after this long (#543).
 *
 * An upload is stored unlinked until the issue, comment or redesign it was
 * made for is saved. Abandoned forms left those rows, with their bytes,
 * in Postgres forever. A week is generous on purpose: unsent drafts are kept
 * in the browser (#326), and an image in a draft someone finishes days later
 * should still be there.
 */
export const UNLINKED_UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How often (1 in N uploads) the site-wide sweep also runs. */
export const SITE_SWEEP_EVERY = 50;

/** Rows removed per sweep, so one request never does unbounded work. */
export const SWEEP_BATCH = 500;

type Db = Pick<PrismaClient, "attachment">;

function unlinkedBefore(cutoff: Date) {
  return { bugId: null, commentId: null, redesignProposalId: null, createdAt: { lt: cutoff } };
}

/**
 * Delete expired unlinked uploads: always this uploader's (cheap, uses the
 * uploaderId/createdAt index), and every SITE_SWEEP_EVERY calls a bounded
 * batch from everyone, so accounts that stopped uploading are cleaned too.
 */
export async function pruneUnlinkedUploads(
  db: Db,
  { uploaderId, now = new Date(), siteSweep = Math.random() * SITE_SWEEP_EVERY < 1 }: {
    uploaderId: string;
    now?: Date;
    siteSweep?: boolean;
  },
): Promise<{ own: number; site: number }> {
  const cutoff = new Date(now.getTime() - UNLINKED_UPLOAD_TTL_MS);
  const own = await db.attachment.deleteMany({ where: { uploaderId, ...unlinkedBefore(cutoff) } });
  let site = 0;
  if (siteSweep) {
    const stale = await db.attachment.findMany({
      where: unlinkedBefore(cutoff),
      select: { id: true },
      take: SWEEP_BATCH,
    });
    if (stale.length > 0) {
      // Re-check "still unlinked" in the delete itself, in case one was attached meanwhile.
      const removed = await db.attachment.deleteMany({
        where: { id: { in: stale.map((row) => row.id) }, ...unlinkedBefore(cutoff) },
      });
      site = removed.count;
    }
  }
  return { own: own.count, site };
}
