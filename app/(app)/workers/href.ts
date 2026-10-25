/** A Ranking URL carrying over an old page's query (filters, paging, search). */
export function workersHref(query: Record<string, string | string[] | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // Ranking has no tabs any more, so the old Team/Leaderboard switch is dropped.
    if (key === "view") continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(key, single);
  }
  const qs = params.toString();
  return qs ? `/workers?${qs}` : "/workers";
}
