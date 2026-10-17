/** Lowercase and strip accents so "José" matches "jose". */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filters people for the assignee picker by name (#174).
 *
 * Matching ignores case and accents and can hit anywhere in the name. Names
 * whose first word, or any later word, starts with the query are listed before
 * names that only contain it; within each group the original (alphabetical)
 * order is kept. An empty query returns everyone.
 */
export function filterPeopleByName<T extends { name: string }>(
  people: readonly T[],
  query: string,
): T[] {
  const q = normalizeName(query);
  if (!q) return [...people];

  const rank = (name: string): number => {
    const n = normalizeName(name);
    if (n.startsWith(q)) return 0;
    if (n.split(/\s+/).some((word) => word.startsWith(q))) return 1;
    if (n.includes(q)) return 2;
    return -1;
  };

  return people
    .map((person, index) => ({ person, index, rank: rank(person.name) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.person);
}
