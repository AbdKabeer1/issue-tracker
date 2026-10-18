import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DONE_STATUSES, milestoneProgress, type MilestoneProgress } from "@/lib/milestones";

export type MilestoneSummary = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  isClosed: boolean;
  progress: MilestoneProgress;
};

/**
 * Milestones with closed/total counts from one grouped query, however many
 * there are. Deleted issues don't count.
 */
export async function loadMilestoneSummaries(
  where: Prisma.MilestoneWhereInput = {},
): Promise<MilestoneSummary[]> {
  const [milestones, groups] = await Promise.all([
    prisma.milestone.findMany({
      where,
      // Soonest due first; undated ones after, by name.
      orderBy: [{ isClosed: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      select: { id: true, title: true, description: true, dueDate: true, isClosed: true },
    }),
    prisma.bug.groupBy({
      by: ["milestoneId", "status"],
      where: { isDeleted: false, milestoneId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, { done: number; total: number }>();
  for (const g of groups) {
    if (!g.milestoneId) continue;
    const c = counts.get(g.milestoneId) ?? { done: 0, total: 0 };
    c.total += g._count._all;
    if (DONE_STATUSES.includes(g.status)) c.done += g._count._all;
    counts.set(g.milestoneId, c);
  }
  return milestones.map((m) => {
    const c = counts.get(m.id) ?? { done: 0, total: 0 };
    return { ...m, progress: milestoneProgress(c.done, c.total) };
  });
}
