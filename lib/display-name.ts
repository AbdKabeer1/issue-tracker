import { z } from "zod";

/**
 * Display names (#293). One rule set for sign-up and for changing it later,
 * so a name that can't be chosen at sign-up can't be switched to afterwards.
 *
 * Names appear beside comments and on issues, so what's rejected is mostly
 * what lets one person pass for another or for the system:
 *  - nothing but whitespace, or invisible/control characters (blank-looking)
 *  - bidirectional overrides, which reorder how the name is drawn
 *  - the word "admin"/"administrator", or the ★ the Admin badge uses, unless
 *    the person is an admin. The badge is what vouches for a role; a name
 *    that imitates it, such as "Sam (Admin)", would fake that.
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

/** Collapse runs of whitespace and normalise, so "A  B" and "A B" are equal. */
export function normalizeDisplayName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Control, format (zero-width, bidi), unassigned, private-use and
// surrogate characters. Ordinary letters in any script, marks (accents),
// digits, punctuation and emoji are not in these categories.
const INVISIBLE_OR_CONTROL = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}]/u;
const ADMIN_LOOKALIKE = /(\badmin(istrator)?s?\b|\bsuper[\s_-]?admin\b|★)/iu;

export type DisplayNameProblem =
  | "blank"
  | "too-short"
  | "too-long"
  | "invisible"
  | "admin-lookalike";

export const DISPLAY_NAME_MESSAGES: Record<DisplayNameProblem, string> = {
  blank: "Enter a display name.",
  "too-short": `Use at least ${DISPLAY_NAME_MIN} characters.`,
  "too-long": `Use at most ${DISPLAY_NAME_MAX} characters.`,
  invisible: "That name has characters that can't be shown. Use letters, numbers and ordinary punctuation.",
  "admin-lookalike": "Names can't include “admin”, which is reserved for the Admin badge.",
};

/** The first thing wrong with a name, or null if it's fine. */
export function displayNameProblem(
  raw: string,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): DisplayNameProblem | null {
  if (INVISIBLE_OR_CONTROL.test(raw.replace(/\s/g, " "))) return "invisible";
  const name = normalizeDisplayName(raw);
  if (name.length === 0) return "blank";
  if ([...name].length < DISPLAY_NAME_MIN) return "too-short";
  if ([...name].length > DISPLAY_NAME_MAX) return "too-long";
  if (!isAdmin && ADMIN_LOOKALIKE.test(name)) return "admin-lookalike";
  return null;
}

/** For forms with no signed-in role yet (sign-up): nobody is an admin. */
export const displayNameSchema = z.string().transform((raw, ctx) => {
  const problem = displayNameProblem(raw);
  if (problem) {
    ctx.addIssue({ code: "custom", message: DISPLAY_NAME_MESSAGES[problem] });
    return z.NEVER;
  }
  return normalizeDisplayName(raw);
});

/** For changing it later, where the person's role is known. */
export function displayNameSchemaFor(isAdmin: boolean) {
  return z.string().transform((raw, ctx) => {
    const problem = displayNameProblem(raw, { isAdmin });
    if (problem) {
      ctx.addIssue({ code: "custom", message: DISPLAY_NAME_MESSAGES[problem] });
      return z.NEVER;
    }
    return normalizeDisplayName(raw);
  });
}
