/** Sort key for bug lists: highest votes first, then most recently updated. */
export type BugPopularitySortKey = {
  voteCount: number;
  updatedAt: Date | string;
};

export function compareBugsByPopularity(
  a: BugPopularitySortKey,
  b: BugPopularitySortKey,
): number {
  if (b.voteCount !== a.voteCount) {
    return b.voteCount - a.voteCount;
  }
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function sortBugsByPopularity<T extends BugPopularitySortKey>(
  bugs: T[],
): T[] {
  return [...bugs].sort(compareBugsByPopularity);
}
