/**
 * Issues carry a short reference number (#1, #2, ...) alongside their cuid, so
 * they can be quoted in a standup, a commit message or a chat without pasting
 * `cmvb3jogf00006n7d73dvs5pg`.
 */

/** The reference as people write it. */
export function formatIssueNumber(n: number): string {
  return `#${n}`;
}

/**
 * The issue number a search box query refers to, or null if it is ordinary
 * text. Accepts "42", "#42" and surrounding spaces.
 *
 * Postgres integers stop at 2147483647, and a query longer than that would
 * make the database throw rather than return nothing, so anything out of
 * range is treated as text.
 */
const MAX_INT4 = 2147483647;

export function parseIssueNumberQuery(query: string): number | null {
  const trimmed = query.trim();
  if (!/^#?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed.replace(/^#/, ""));
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_INT4) return null;
  return n;
}
