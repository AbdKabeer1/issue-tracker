import type { Prisma } from "@prisma/client";
import { DEFAULT_BUG_SORT, type BugSortOption } from "@/lib/issues-sort";
import { watchingWhere } from "@/lib/watching";

/** "Show" filter on the issues list (#152), kept in the URL as `?mine=`. */
export const MINE_FILTER_OPTIONS = ["assigned", "reported", "watching"] as const;
export type MineFilter = (typeof MINE_FILTER_OPTIONS)[number];

export const mineFilterLabels: Record<MineFilter, string> = {
  assigned: "Assigned to me",
  reported: "Reported by me",
  watching: "Issues I'm watching",
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
  if (filter === "watching") return watchingWhere(userId);
  return filter === "assigned" ? { assigneeId: userId } : { reporterId: userId };
}

/**
 * What the list is sorted by when the URL doesn't say. A list of what you're
 * watching is read for what moved, so it starts with the latest activity;
 * every other view keeps the usual default.
 */
export function defaultSortFor(filter: MineFilter | null): BugSortOption {
  return filter === "watching" ? "recently_updated" : DEFAULT_BUG_SORT;
}
