import type { Prisma } from "@prisma/client";

/** "Show" filter on the issues list (#152), kept in the URL as `?mine=`. */
export const MINE_FILTER_OPTIONS = ["assigned", "reported"] as const;
export type MineFilter = (typeof MINE_FILTER_OPTIONS)[number];

export const mineFilterLabels: Record<MineFilter, string> = {
  assigned: "Assigned to me",
  reported: "Reported by me",
};

export function parseMineFilter(raw?: string | string[] | null): MineFilter | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return value && (MINE_FILTER_OPTIONS as readonly string[]).includes(value)
    ? (value as MineFilter)
    : null;
}

/** Prisma condition for the filter, or an empty object when it doesn't apply. */
export function mineFilterWhere(
  filter: MineFilter | null,
  userId: string | undefined,
): Prisma.BugWhereInput {
  if (!filter || !userId) return {};
  return filter === "assigned" ? { assigneeId: userId } : { reporterId: userId };
}
