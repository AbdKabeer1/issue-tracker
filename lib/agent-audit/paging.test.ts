import { describe, expect, it } from "vitest";
import { AUDIT_PAGE_SIZE, auditPageHref, splitAuditPage } from "./paging";

describe("audit log paging (#576)", () => {
  it("builds page links that keep the filters and leave out empty ones", () => {
    expect(auditPageHref({})).toBe("/settings/audit");
    expect(auditPageHref({ agent: "a1", issue: "#42", before: "e9" })).toBe(
      "/settings/audit?agent=a1&issue=%2342&before=e9",
    );
    expect(auditPageHref({ agent: null, issue: "", before: "e9" })).toBe("/settings/audit?before=e9");
  });

  it("has an older page only when one row more than a page came back", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));

    const full = splitAuditPage(rows(AUDIT_PAGE_SIZE + 1));
    expect(full.page).toHaveLength(AUDIT_PAGE_SIZE);
    expect(full.olderCursor).toBe(`e${AUDIT_PAGE_SIZE - 1}`);

    expect(splitAuditPage(rows(AUDIT_PAGE_SIZE)).olderCursor).toBeNull();
    expect(splitAuditPage([]).olderCursor).toBeNull();
  });

  it("uses the last row shown as the cursor", () => {
    expect(splitAuditPage([{ id: "a" }, { id: "b" }, { id: "c" }], 2)).toEqual({
      page: [{ id: "a" }, { id: "b" }],
      olderCursor: "b",
    });
  });
});
