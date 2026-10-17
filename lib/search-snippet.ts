/**
 * Search-result snippets (#301).
 *
 * Builds plain-text segments — never HTML — so the caller renders them as
 * React text and the stored description can't inject markup, whatever it
 * contains. Matching is case-insensitive and literal: the query is escaped
 * before it becomes a RegExp, so `.*` or `(` in a search mean themselves,
 * the same as the database's escaped ILIKE.
 */

export type Segment = { text: string; match: boolean };

export type Snippet = {
  segments: Segment[];
  /** Text was cut before the first segment. */
  before: boolean;
  /** Text was cut after the last segment. */
  after: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matcher(query: string): RegExp | null {
  const q = query.trim();
  if (!q) return null;
  // `u` keeps indices in code points' terms consistent with String.slice on
  // surrogate pairs, and case folding here never changes the text's length
  // (unlike lowercasing the haystack, where "İ" becomes two characters).
  return new RegExp(escapeRegExp(q), "giu");
}

/**
 * Splits `text` into matched / unmatched runs. Returns a single unmatched
 * segment when nothing matches, and [] for empty text.
 */
export function highlightSegments(text: string, query: string): Segment[] {
  if (!text) return [];
  const re = matcher(query);
  if (!re) return [{ text, match: false }];
  const segments: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), match: false });
    segments.push({ text: m[0], match: true });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

export function hasMatch(text: string, query: string): boolean {
  const re = matcher(query);
  return re ? re.test(text) : false;
}

/**
 * Reduces Markdown to the words a reader sees, so a snippet doesn't open on
 * "](https://…" or a run of backticks. Deliberately rough — this is a
 * preview line, not a renderer — and its output is only ever React text.
 */
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, " ") // fence lines (keep the code itself)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
    .replace(/<[^>]+>/g, " ") // stray HTML tags
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
    .replace(/(\*\*|__|~~|`)/g, "") // emphasis and code markers
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A window of about `radius` characters either side of the first match in
 * `text`, split into segments. Returns null when the query doesn't occur,
 * so the caller shows nothing rather than an unrelated excerpt.
 *
 * The window is widened to word boundaries so it doesn't start or end
 * mid-word.
 */
export function matchSnippet(
  text: string,
  query: string,
  radius = 60,
): Snippet | null {
  const re = matcher(query);
  if (!re || !text) return null;
  const first = re.exec(text);
  if (!first) return null;

  const matchStart = first.index;
  const matchEnd = matchStart + first[0].length;
  let start = Math.max(0, matchStart - radius);
  let end = Math.min(text.length, matchEnd + radius);

  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < matchStart) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space >= matchEnd) end = space;
  }

  return {
    segments: highlightSegments(text.slice(start, end), query),
    before: start > 0,
    after: end < text.length,
  };
}
