/**
 * Soft @mentions stored in comment bodies as `@[Display Name](userId)`.
 * Push / in-app notifications are out of scope — mentions are persisted in
 * the comment text and highlighted on render only.
 */

export type MentionToken =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; userId: string };

/** Matches a complete soft-mention tag. */
export const MENTION_TAG_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

export function formatMention(name: string, userId: string): string {
  const safeName = name.replace(/[\[\]]/g, "").trim() || "user";
  return `@[${safeName}](${userId})`;
}

/** Unique user ids referenced by well-formed mention tags in `body`. */
export function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(MENTION_TAG_RE)) {
    const userId = match[2]?.trim();
    if (userId) ids.add(userId);
  }
  return [...ids];
}

/**
 * User ids mentioned in `nextBody` but not in `previousBody`, so an edit
 * only notifies people it newly tags instead of re-emailing everyone (#228).
 */
export function newlyMentionedUserIds(
  previousBody: string,
  nextBody: string,
): string[] {
  const before = new Set(extractMentionedUserIds(previousBody));
  return extractMentionedUserIds(nextBody).filter((id) => !before.has(id));
}

/**
 * Verifies mentions against known users.
 * Replaces unknown user IDs with plain text `@name`.
 * Canonicalizes known user mentions to their real name from the database.
 */
export function normalizeMentions(
  body: string,
  userMap: Map<string, string> | Record<string, string>,
): string {
  const getName = (id: string) =>
    userMap instanceof Map ? userMap.get(id) : userMap[id];

  const re = new RegExp(MENTION_TAG_RE.source, "g");
  return body.replace(re, (_match, typedName, userId) => {
    const trimmedId = String(userId).trim();
    const realName = getName(trimmedId);
    if (!realName) {
      return `@${String(typedName).trim()}`;
    }
    return formatMention(realName, trimmedId);
  });
}

/**
 * Split comment text into plain segments and mention tags.
 * Malformed `@…` sequences stay in text tokens and never throw.
 */
export function tokenizeMentions(body: string): MentionToken[] {
  if (!body) return [{ type: "text", value: "" }];

  const tokens: MentionToken[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_TAG_RE.source, "g");

  for (const match of body.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: "text", value: body.slice(lastIndex, index) });
    }
    const name = match[1]?.trim() ?? "";
    const userId = match[2]?.trim() ?? "";
    if (name && userId) {
      tokens.push({ type: "mention", name, userId });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    tokens.push({ type: "text", value: body.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: body }];
}

export type MentionQuery = {
  /** Index of the triggering `@` in the full string. */
  start: number;
  /** Text after `@` up to the caret (no spaces). */
  query: string;
};

/**
 * Detect an open @mention query at `caret`. Returns null when the caret is
 * not inside a mention draft (including inside a completed `@[…](…)` tag,
 * inside a fenced code block, or inside inline code).
 */
export function getMentionQuery(
  value: string,
  caret: number,
): MentionQuery | null {
  if (caret < 0 || caret > value.length) return null;
  if (isInsideCode(value, caret)) return null;

  const before = value.slice(0, caret);
  const match = before.match(/(^|[\s])@([^\s@[\]]*)$/);
  if (!match) return null;

  const query = match[2] ?? "";
  const start = caret - query.length - 1;
  return { start, query };
}

/** True when `caret` sits inside a fenced or inline code span. */
function isInsideCode(value: string, caret: number): boolean {
  const before = value.slice(0, caret);
  const fence = before.match(/```[\s\S]*?(?:```|$)/g)?.pop();
  if (fence && fence.startsWith("```") && !fence.endsWith("```")) return true;
  return (before.match(/`/g)?.length ?? 0) % 2 === 1;
}

export function filterUsersForMention<T extends { name: string }>(
  users: T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((user) => user.name.toLowerCase().includes(q))
    : users;
  return filtered.slice(0, limit);
}

/** Replace the open `@query` at `mention.start` with a formatted mention tag. */
export function insertMention(
  value: string,
  mention: MentionQuery,
  caret: number,
  name: string,
  userId: string,
): { value: string; caret: number } {
  const tag = formatMention(name, userId);
  const before = value.slice(0, mention.start);
  const after = value.slice(caret);
  const next = `${before}${tag} ${after}`;
  return { value: next, caret: before.length + tag.length + 1 };
}
