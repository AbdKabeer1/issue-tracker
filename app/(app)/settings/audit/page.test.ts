import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/tenant-context", () => ({
  currentTenantIdFor: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: vi.fn() },
    agentAuditEvent: { findMany: vi.fn() },
    membership: { findUnique: vi.fn() },
  },
}));

import { forbidden } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import AuditLogPage from "./page";

const mockUser = requireUser as unknown as ReturnType<typeof vi.fn>;
const mockTenant = currentTenantIdFor as unknown as ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  agent: { findMany: ReturnType<typeof vi.fn> };
  agentAuditEvent: { findMany: ReturnType<typeof vi.fn> };
  membership: { findUnique: ReturnType<typeof vi.fn> };
};

const open = (params: Record<string, string> = {}) => AuditLogPage({ searchParams: Promise.resolve(params) });

describe("agent audit log page (#447)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.agentAuditEvent.findMany.mockResolvedValue([]);
  });

  it("answers 403 to an ordinary member with no agents", async () => {
    mockUser.mockResolvedValue({ id: "member", role: "user" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    db.agent.findMany.mockResolvedValue([]);

    await expect(open()).rejects.toThrow("NEXT_FORBIDDEN");
    expect(forbidden).toHaveBeenCalled();
    expect(db.agentAuditEvent.findMany).not.toHaveBeenCalled();
  });

  it("answers 403 to someone with no tenant", async () => {
    mockUser.mockResolvedValue({ id: "new", role: "user" });
    mockTenant.mockResolvedValue(null);
    db.membership.findUnique.mockResolvedValue(null);
    await expect(open()).rejects.toThrow("NEXT_FORBIDDEN");
  });

  it("shows an agent owner only their own agents' rows", async () => {
    mockUser.mockResolvedValue({ id: "alice", role: "user" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    db.agent.findMany.mockResolvedValue([{ id: "agent-alice", name: "Alice's Claude" }]);

    await open();

    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where).toEqual({
      tenantId: "tenant-zedu",
      agentId: { in: ["agent-alice"] },
      NOT: { payload: { path: ["request"], equals: true } },
    });
  });

  it("shows a tenant admin every row, with the agent and issue filters", async () => {
    mockUser.mockResolvedValue({ id: "admin", role: "user" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "admin" });
    db.agent.findMany.mockResolvedValue([]);

    await open({ agent: "agent-bob", issue: "bug-1" });

    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where).toEqual({
      tenantId: "tenant-zedu",
      agentId: "agent-bob",
      bugId: "bug-1",
      NOT: { payload: { path: ["request"], equals: true } },
    });
  });

  it("lets the site super admin in without a tenant admin role", async () => {
    mockUser.mockResolvedValue({ id: "root", role: "super_admin" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    db.agent.findMany.mockResolvedValue([]);

    await open();
    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where).toEqual({
      tenantId: "tenant-zedu",
      NOT: { payload: { path: ["request"], equals: true } },
    });
  });

  it("includes request rows only when asked (#575)", async () => {
    mockUser.mockResolvedValue({ id: "admin", role: "user" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "admin" });
    db.agent.findMany.mockResolvedValue([]);

    await open({ show: "requests" });
    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where).toEqual({ tenantId: "tenant-zedu" });
  });
});
