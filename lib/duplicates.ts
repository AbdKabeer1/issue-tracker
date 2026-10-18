import type { Prisma } from "@prisma/client";
import { formatIssueNumber } from "@/lib/issue-number";

/**
 * Marking an issue as a duplicate of another (#285).
 *
 * One level only: an issue is either canonical (others may point at it)
 * or a duplicate (it points at a canonical one). That rules out chains and
 * cycles by construction:
 * - the target can't itself be a duplicate;
 * - an issue others already point at can't become a duplicate.
 *
 * Votes are not merged in this first pass.
 */

/** `?duplicates=show` includes duplicates in the list; default hides them. */
export const DUPLICATES_PARAM = "duplicates";
export const SHOW_DUPLICATES = "show";

export function parseShowDuplicates(raw: string | string[] | undefined): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === SHOW_DUPLICATES;
}

/** The list's condition: duplicates are hidden unless asked for. */
export function duplicatesWhere(show: boolean): Prisma.BugWhereInput {
  return show ? {} : { duplicateOfId: null };
}

export type LinkSide = {
  id: string;
  number: number;
  isDeleted: boolean;
  duplicateOfId: string | null;
};

export const DUPLICATE_ERRORS = {
  notFound: "That issue doesn't exist.",
  self: "An issue can't be a duplicate of itself.",
  targetDeleted: "That issue was deleted. Restore it first, or pick another.",
  sourceDeleted: "This issue was deleted. Restore it before linking it.",
} as const;

/**
 * Whether `bug` may be marked a duplicate of `target`. `incoming` is how
 * many issues are currently marked as duplicates of `bug`.
 */
export function duplicateLinkProblem(
  bug: LinkSide,
  target: LinkSide | null,
  incoming: number,
  targetCanonical?: { number: number } | null,
): string | null {
  if (!target) return DUPLICATE_ERRORS.notFound;
  if (target.id === bug.id) return DUPLICATE_ERRORS.self;
  if (bug.isDeleted) return DUPLICATE_ERRORS.sourceDeleted;
  if (target.isDeleted) return DUPLICATE_ERRORS.targetDeleted;
  if (target.duplicateOfId) {
    const where = targetCanonical ? ` Mark this one a duplicate of ${formatIssueNumber(targetCanonical.number)} instead.` : "";
    return `${formatIssueNumber(target.number)} is itself a duplicate.${where}`;
  }
  if (incoming > 0) {
    return `${incoming} issue${incoming === 1 ? " is" : "s are"} marked as duplicate${incoming === 1 ? "" : "s"} of this one. Point ${incoming === 1 ? "it" : "them"} at ${formatIssueNumber(target.number)} first, or clear ${incoming === 1 ? "it" : "them"}.`;
  }
  return null;
}

/** "#12", "12", or a pasted issue URL ending in the id. */
export type IssueRef = { number: number } | { id: string };

export function parseIssueRef(raw: string): IssueRef | null {
  const text = raw.trim();
  const num = /^#?(\d{1,9})$/.exec(text);
  if (num) {
    const n = Number(num[1]);
    return n >= 1 ? { number: n } : null;
  }
  const url = /\/bugs\/([A-Za-z0-9_-]{6,40})(?:[/?#]|$)/.exec(text);
  if (url) return { id: url[1] };
  if (/^[a-z0-9]{20,40}$/.test(text)) return { id: text };
  return null;
}
