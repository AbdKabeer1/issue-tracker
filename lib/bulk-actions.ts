import { severities, statuses } from "@/lib/validations/issue";

/**
 * Validation for bulk triage, kept away from the server action so the rules
 * can be tested without a database.
 */

/**
 * The most issues one bulk change may touch. The whole change runs in a
 * single transaction, and a transaction that walks thousands of rows holds
 * locks long enough to block everyone else triaging at the same time.
 */
export const MAX_BULK_IDS = 100;

export const BULK_FIELDS = [
  "status",
  "severity",
  "typeId",
  "categoryId",
  "assigneeId",
] as const;

export type BulkField = (typeof BULK_FIELDS)[number];

/** The caller's requested change, before it has been checked. */
export type BulkChange = Partial<Record<BulkField, string>>;

export type BulkValidation =
  | { ok: true; ids: string[]; change: Record<string, string | null> }
  | { ok: false; error: string };

/**
 * "" means "clear this field" for the three that are nullable; status and
 * severity are not nullable, so an empty value there is simply not a change.
 */
const NULLABLE: ReadonlySet<BulkField> = new Set([
  "typeId",
  "categoryId",
  "assigneeId",
]);

export function validateBulk(
  rawIds: unknown,
  rawChange: unknown,
): BulkValidation {
  if (!Array.isArray(rawIds)) return { ok: false, error: "No issues selected" };

  const ids = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { ok: false, error: "No issues selected" };
  if (ids.length > MAX_BULK_IDS) {
    return {
      ok: false,
      error: `Select at most ${MAX_BULK_IDS} issues at a time.`,
    };
  }

  if (typeof rawChange !== "object" || rawChange === null) {
    return { ok: false, error: "Nothing to change" };
  }

  const incoming = rawChange as Record<string, unknown>;
  const change: Record<string, string | null> = {};

  for (const field of BULK_FIELDS) {
    const value = incoming[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      return { ok: false, error: "Nothing to change" };
    }

    if (value === "") {
      // Only the nullable fields can be cleared; an empty status is a
      // no-op, not a request to unset a column that cannot be null.
      if (NULLABLE.has(field)) change[field] = null;
      continue;
    }

    if (field === "status" && !(statuses as readonly string[]).includes(value)) {
      return { ok: false, error: "Invalid status" };
    }
    if (field === "severity" && !(severities as readonly string[]).includes(value)) {
      return { ok: false, error: "Invalid severity" };
    }
    change[field] = value;
  }

  if (Object.keys(change).length === 0) {
    return { ok: false, error: "Nothing to change" };
  }

  return { ok: true, ids, change };
}
