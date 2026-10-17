/**
 * Filtering the issues list by issue type ("tags": Design, Marketing, Fix...)
 * from the search box (#102). Tags travel in the URL as one comma-separated
 * parameter, `?tags=design,marketing`, so links and pagination keep them.
 */

export const TAGS_PARAM = "tags";
export const MAX_TAGS = 10;

type TagType = { id: string; name: string };

const norm = (value: string) => value.trim().toLowerCase();

/** Canonical type names for the `tags` param: known types only, deduped, in URL order. */
export function parseTagFilter<T extends TagType>(
  raw: string | string[] | null | undefined,
  types: readonly T[],
): T[] {
  const values = (Array.isArray(raw) ? raw : [raw ?? ""])
    .flatMap((v) => v.split(","))
    .map(norm)
    .filter(Boolean);

  const byName = new Map(types.map((t) => [norm(t.name), t]));
  const picked: T[] = [];
  for (const value of values) {
    const type = byName.get(value);
    if (type && !picked.includes(type)) picked.push(type);
    if (picked.length >= MAX_TAGS) break;
  }
  return picked;
}

/**
 * Ids of every type whose name matches a selected tag, ignoring case. Older
 * databases can hold "Fix" and "fix" side by side; both should match.
 */
export function tagTypeIds<T extends TagType>(selected: readonly T[], types: readonly T[]): string[] {
  const names = new Set(selected.map((t) => norm(t.name)));
  return types.filter((t) => names.has(norm(t.name))).map((t) => t.id);
}

/** Value for the `tags` param, or "" to remove it. */
export function serializeTags(names: readonly string[]): string {
  return names.map(norm).filter(Boolean).join(",");
}

/**
 * Types to suggest while typing in the search box: names starting with the
 * query first, then names containing it; already-selected tags are left out.
 */
export function suggestTags<T extends { name: string }>(
  types: readonly T[],
  query: string,
  selected: readonly string[] = [],
  limit = 6,
): T[] {
  const q = norm(query.replace(/^#/, ""));
  if (!q) return [];
  const taken = new Set(selected.map(norm));
  const seen = new Set<string>();
  const candidates = types.filter((t) => {
    const name = norm(t.name);
    if (taken.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  const starts = candidates.filter((t) => norm(t.name).startsWith(q));
  const contains = candidates.filter(
    (t) => !norm(t.name).startsWith(q) && norm(t.name).includes(q),
  );
  return [...starts, ...contains].slice(0, limit);
}
