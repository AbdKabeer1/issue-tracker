import { describe, expect, it } from "vitest";
import { auditAccess, auditWhere } from "./visibility";

const tenantId = "tenant-zedu";

describe("audit log visibility (#447)", () => {
  it("lets a tenant owner, admin or super admin read every row in the tenant", () => {
    const access = auditAccess({ isTenantAdmin: true, tenantId, ownedAgentIds: [] });
    expect(access).toEqual({ kind: "all", tenantId });
    expect(auditWhere(access)).toEqual({ tenantId });
  });

  it("lets an agent owner read only their own agents' rows", () => {
    const access = auditAccess({ isTenantAdmin: false, tenantId, ownedAgentIds: ["agent-alice"] });
    expect(access.kind).toBe("own-agents");
    expect(auditWhere(access)).toEqual({ tenantId, agentId: { in: ["agent-alice"] } });
  });

  it("never shows another owner's rows, even when filtering by their agent", () => {
    const access = auditAccess({ isTenantAdmin: false, tenantId, ownedAgentIds: ["agent-alice"] });
    expect(auditWhere(access, { agentId: "agent-bob" })).toEqual({ tenantId, agentId: { in: [] } });
    expect(auditWhere(access, { agentId: "agent-alice" })).toEqual({ tenantId, agentId: "agent-alice" });
  });

  it("forbids an ordinary member with no agents", () => {
    expect(auditAccess({ isTenantAdmin: false, tenantId, ownedAgentIds: [] })).toEqual({ kind: "forbidden" });
  });

  it("forbids someone with no tenant, even an admin", () => {
    expect(auditAccess({ isTenantAdmin: true, tenantId: null, ownedAgentIds: ["agent-alice"] }).kind).toBe(
      "forbidden",
    );
  });

  it("filters by agent and by issue", () => {
    const access = auditAccess({ isTenantAdmin: true, tenantId, ownedAgentIds: [] });
    expect(auditWhere(access, { agentId: "agent-bob", issueId: "bug-1" })).toEqual({
      tenantId,
      agentId: "agent-bob",
      bugId: "bug-1",
    });
  });

  it("refuses to build a query for a forbidden viewer", () => {
    expect(() => auditWhere({ kind: "forbidden" })).toThrow();
  });
});
