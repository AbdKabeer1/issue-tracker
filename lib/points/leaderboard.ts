import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Point balances and the leaderboard (#428), always inside one tenant.
 *
 * A balance is the sum of a person's ledger rows, corrections included. A
 * solved task is a positive solver entry that hasn't been corrected.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type PointTotals = { points: number; solvedTasks: number };

export type LeaderboardEntry = PointTotals & {
  userId: string;
  name: string;
  image: string | null;
  rank: number;
};

const solvedWhere = (tenantId: string): Prisma.PointEntryWhereInput => ({
  tenantId,
  role: "solver",
  points: { gt: 0 },
  correctedAt: null,
});

/** One person's balance and solved-task count in `tenantId`. */
export async function pointTotals(db: Db, tenantId: string, userId: string): Promise<PointTotals> {
  const [sum, solvedTasks] = await Promise.all([
    db.pointEntry.aggregate({ where: { tenantId, userId }, _sum: { points: true } }),
    db.pointEntry.count({ where: { ...solvedWhere(tenantId), userId } }),
  ]);
  return { points: sum._sum.points ?? 0, solvedTasks };
}

/**
 * Orders people by points, then solved tasks, then name, and numbers them.
 * People level on both points and solved tasks share a rank (1, 2, 2, 4).
 */
export function rankLeaderboard(rows: ReadonlyArray<Omit<LeaderboardEntry, "rank">>): LeaderboardEntry[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.solvedTasks - a.solvedTasks || a.name.localeCompare(b.name),
  );
  const ranked: LeaderboardEntry[] = [];
  sorted.forEach((row, index) => {
    const previous = ranked[index - 1];
    const tied = previous && previous.points === row.points && previous.solvedTasks === row.solvedTasks;
    ranked.push({ ...row, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}

/** Members of `tenantId` with any points, ranked. Non-members never appear. */
export async function tenantLeaderboard(db: Db, tenantId: string, limit = 50): Promise<LeaderboardEntry[]> {
  const memberOnly = { user: { memberships: { some: { tenantId } } } } satisfies Prisma.PointEntryWhereInput;
  const [balances, solved] = await Promise.all([
    db.pointEntry.groupBy({
      by: ["userId"],
      where: { tenantId, ...memberOnly },
      _sum: { points: true },
    }),
    db.pointEntry.groupBy({
      by: ["userId"],
      where: { ...solvedWhere(tenantId), ...memberOnly },
      _count: { _all: true },
    }),
  ]);
  if (balances.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: balances.map((b) => b.userId) } },
    select: { id: true, name: true, image: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const solvedById = new Map(solved.map((s) => [s.userId, s._count._all]));

  const rows = balances.flatMap((b) => {
    const user = byId.get(b.userId);
    if (!user) return [];
    return [{
      userId: b.userId,
      name: user.name,
      image: user.image,
      points: b._sum.points ?? 0,
      solvedTasks: solvedById.get(b.userId) ?? 0,
    }];
  });
  return rankLeaderboard(rows).slice(0, limit);
}
