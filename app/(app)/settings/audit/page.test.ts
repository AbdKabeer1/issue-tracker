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
    bug: { findFirst: vi.fn() },
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
  bug: { findFirst: ReturnType<typeof vi.fn> };
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

describe("audit log paging and issue numbers (#576)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.agentAuditEvent.findMany.mockResolvedValue([]);
    mockUser.mockResolvedValue({ id: "admin", role: "user" });
    mockTenant.mockResolvedValue("tenant-zedu");
    db.membership.findUnique.mockResolvedValue({ role: "admin" });
    db.agent.findMany.mockResolvedValue([]);
  });

  it("fetches one row past the page, newest first with a stable tie-break", async () => {
    await open();
    const query = db.agentAuditEvent.findMany.mock.calls[0][0];
    expect(query.take).toBe(101);
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(query.cursor).toBeUndefined();
  });

  it("pages back from the ?before= cursor", async () => {
    await open({ before: "event-200" });
    const query = db.agentAuditEvent.findMany.mock.calls[0][0];
    expect(query.cursor).toEqual({ id: "event-200" });
    expect(query.skip).toBe(1);
  });

  it("filters by #number, looked up inside the viewer's workspace", async () => {
    db.bug.findFirst.mockResolvedValue({ id: "bug-cuid-42" });
    await open({ issue: "#42" });
    expect(db.bug.findFirst).toHaveBeenCalledWith({
      where: { number: 42, tenantId: "tenant-zedu" },
      select: { id: true },
    });
    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where).toEqual({
      tenantId: "tenant-zedu",
      bugId: "bug-cuid-42",
      NOT: { payload: { path: ["request"], equals: true } },
    });
  });

  it("still accepts a bare number or an internal id", async () => {
    db.bug.findFirst.mockResolvedValue({ id: "bug-cuid-7" });
    await open({ issue: "7" });
    expect(db.agentAuditEvent.findMany.mock.calls[0][0].where.bugId).toBe("bug-cuid-7");

    await open({ issue: "cm0abcdefghijklmnopqrstu" });
    expect(db.agentAuditEvent.findMany.mock.calls[1][0].where.bugId).toBe("cm0abcdefghijklmnopqrstu");
  });

  it("shows nothing, rather than everything, for an issue not in this workspace", async () => {
    db.bug.findFirst.mockResolvedValue(null);
    await open({ issue: "#9999" });
    expect(db.agentAuditEvent.findMany).not.toHaveBeenCalled();
  });
});
