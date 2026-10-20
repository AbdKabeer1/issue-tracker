import { describe, expect, it } from "vitest";
import { solverAwardForBulkChange } from "./bulk-award";

const bug = {
  id: "bug-1",
  tenantId: "tenant-zedu",
  status: "open" as const,
  severity: "high" as const,
  assigneeId: "ada",
};

describe("solverAwardForBulkChange", () => {
  it("awards the assignee when a bulk change resolves the issue", () => {
    expect(solverAwardForBulkChange(bug, { status: "resolved" })).toEqual({
      id: "bug-1",
      tenantId: "tenant-zedu",
      severity: "high",
      assigneeId: "ada",
    });
  });

  it("uses the assignee and severity from the same change", () => {
    expect(
      solverAwardForBulkChange(bug, {
        status: "resolved",
        assigneeId: "sam",
        severity: "critical",
      }),
    ).toMatchObject({ assigneeId: "sam", severity: "critical" });
  });

  it("awards nobody when the issue was already resolved or is not being resolved", () => {
    expect(solverAwardForBulkChange({ ...bug, status: "resolved" }, { status: "resolved" })).toBeNull();
    expect(solverAwardForBulkChange(bug, { status: "closed" })).toBeNull();
    expect(solverAwardForBulkChange(bug, { status: "resolved", assigneeId: null })).toMatchObject({
      assigneeId: null,
    });
  });
});
