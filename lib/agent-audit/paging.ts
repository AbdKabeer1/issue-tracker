/**
 * Paging for the audit log (#576). Pages go back in time from a cursor: the
 * id of the last row shown, passed as `?before=`.
 */

/** Rows per page. */
export const AUDIT_PAGE_SIZE = 100;

export type AuditPageParams = {
  agent?: string | null;
  issue?: string | null;
  before?: string | null;
  show?: string | null;
};

/** `/settings/audit` with the given filters and cursor; empty values are left out. */
export function auditPageHref(params: AuditPageParams): string {
  const query = new URLSearchParams();
  if (params.agent) query.set("agent", params.agent);
  if (params.issue) query.set("issue", params.issue);
  if (params.before) query.set("before", params.before);
  if (params.show) query.set("show", params.show);
  const qs = query.toString();
  return qs ? `/settings/audit?${qs}` : "/settings/audit";
}

/**
 * Splits a fetch of `pageSize + 1` rows into the page and the cursor for the
 * next, older page (null when this is the oldest page).
 */
export function splitAuditPage<T extends { id: string }>(
  rows: ReadonlyArray<T>,
  pageSize = AUDIT_PAGE_SIZE,
): { page: T[]; olderCursor: string | null } {
  const page = rows.slice(0, pageSize);
  return { page, olderCursor: rows.length > pageSize ? (page.at(-1)?.id ?? null) : null };
}
