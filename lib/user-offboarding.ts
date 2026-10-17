import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Options for deleting or offboarding a user account safely (#356).
 */
export type OffboardUserOptions = {
  /**
   * Target user ID to reassign any reported bugs to (e.g. system bot or administrator).
   * If omitted and the user has reported bugs, offboarding will reject with an error
   * explaining that reported bugs must be preserved.
   */
  fallbackReporterId?: string;
};

export type OffboardUserResult = {
  ok: true;
  userId: string;
  unassignedBugCount: number;
  reassignedBugCount: number;
};

export class UserHasReportedBugsError extends Error {
  constructor(public readonly bugCount: number) {
    super(
      `Cannot delete user who has reported ${bugCount} issue${bugCount === 1 ? "" : "s"} without specifying a fallbackReporterId for reassignment.`,
    );
    this.name = "UserHasReportedBugsError";
  }
}

/**
 * Safely offboard and delete a user account without violating PostgreSQL foreign key constraints (#356).
 *
 * 1. Checks if the user exists.
 * 2. Unassigns any issues assigned to this user (`assigneeId = null`).
 * 3. If the user reported bugs:
 *    - If `fallbackReporterId` is provided, reassigns `reporterId` to the fallback user.
 *    - If no fallback is provided, throws `UserHasReportedBugsError`.
 * 4. Deletes the user record (cascading votes, watches, attachments, notifications, and reset tokens).
 */
export async function offboardUser(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
  options: OffboardUserOptions = {},
): Promise<OffboardUserResult> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User with ID "${userId}" not found.`);
  }

  // Count assigned bugs and unassign them
  const assignedBugs = await client.bug.updateMany({
    where: { assigneeId: userId },
    data: { assigneeId: null },
  });

  // Check reported bugs
  const reportedCount = await client.bug.count({
    where: { reporterId: userId },
  });

  let reassignedCount = 0;
  if (reportedCount > 0) {
    if (!options.fallbackReporterId) {
      throw new UserHasReportedBugsError(reportedCount);
    }

    // Verify fallback reporter exists
    const fallback = await client.user.findUnique({
      where: { id: options.fallbackReporterId },
      select: { id: true },
    });
    if (!fallback) {
      throw new Error(`Fallback reporter user "${options.fallbackReporterId}" not found.`);
    }

    const reassigned = await client.bug.updateMany({
      where: { reporterId: userId },
      data: { reporterId: options.fallbackReporterId },
    });
    reassignedCount = reassigned.count;
  }

  // Delete the user account
  await client.user.delete({
    where: { id: userId },
  });

  return {
    ok: true,
    userId,
    unassignedBugCount: assignedBugs.count,
    reassignedBugCount: reassignedCount,
  };
}
