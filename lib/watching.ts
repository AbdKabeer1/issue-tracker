import type { Prisma } from "@prisma/client";

/**
 * "Issues I'm watching" (#312).
 *
 * Watching is partly implicit (see lib/watch.ts): the reporter and assignee
 * hear about an issue without ever pressing Watch, and issues from before
 * the watch feature have no row at all. Someone is watching an issue when
 *
 *  - they have an explicit Watch row saying so, or
 *  - they are the reporter or assignee and have not explicitly unwatched.
 *
 * That is exactly the audience `resolveWatchers` builds for emails, so the
 * list can't disagree with who actually gets mailed.
 *
 * Returned as a single `AND` entry rather than a top-level `OR`: the list's
 * search box assigns `where.OR` for itself, and a second `OR` would be
 * silently overwritten by it.
 */
export function watchingWhere(userId: string): Prisma.BugWhereInput {
  return {
    AND: [
      {
        OR: [
          { watches: { some: { userId, watching: true } } },
          {
            AND: [
              { OR: [{ reporterId: userId }, { assigneeId: userId }] },
              { watches: { none: { userId, watching: false } } },
            ],
          },
        ],
      },
    ],
  };
}

/** Statuses that count as finished, for "stop watching resolved issues". */
export const FINISHED_STATUSES = ["resolved", "closed"] as const;

/**
 * Watched, still visible, and finished. The same filter feeds the count on
 * the button and the action behind it, so the button never promises one
 * number and does another.
 */
export function finishedWatchedWhere(userId: string): Prisma.BugWhereInput {
  return {
    isDeleted: false,
    status: { in: [...FINISHED_STATUSES] },
    ...watchingWhere(userId),
  };
}
