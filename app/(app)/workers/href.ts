/** A Workers URL for a tab, carrying over an old page's query (filters, paging, search). */
export function workersHref(
  view: "team" | "leaderboard",
  query: Record<string, string | string[] | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (view === "leaderboard") params.set("view", "leaderboard");
  for (const [key, value] of Object.entries(query)) {
    if (key === "view") continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(key, single);
  }
  const qs = params.toString();
  return qs ? `/workers?${qs}` : "/workers";
}
