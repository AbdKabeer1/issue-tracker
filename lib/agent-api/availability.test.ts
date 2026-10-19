import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  agentApiKey: { findUnique: vi.fn() }, agentAuditEvent: { create: vi.fn() },
  project: { findFirst: vi.fn(), findUnique: vi.fn() },
  issueClaim: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  bug: { updateMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), budget: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth-helpers", () => ({ requireSuperAdmin: mocks.admin }));
vi.mock("@/lib/agents/rate-budget", async (original) => ({ ...await original<typeof import("@/lib/agents/rate-budget")>(), consumeAgentBudget: mocks.budget }));
import { releaseStaleClaims } from "./availability";
import { POST } from "@/app/api/v1/issues/[id]/heartbeat/route";

const now = new Date("2026-10-19T12:00:00Z");
const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
const stale = new Date(cutoff.getTime() - 1);
const claim = { id: "claim", bugId: "issue", agentId: "agent", beneficiaryUserId: "owner", status: "active", releasedAt: null, claimedAt: stale, lastHeartbeatAt: stale };
const context = { params: Promise.resolve({ id: "issue" }) };
function request(query = "?projectId=project", key = true) {
  return new NextRequest(`http://localhost/api/v1/issues/issue/heartbeat${query}`, { method: "POST", headers: key ? { authorization: "Bearer ziki_test" } : {} });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  db.agentApiKey.findUnique.mockResolvedValue({ id: "key", revokedAt: null, agent: { id: "agent", name: "Agent", ownerUserId: "owner", tenantId: "tenant", level: "contributor", burst: false, revokedAt: null, owner: { memberships: [{ tenantId: "tenant" }] } } });
  db.project.findFirst.mockResolvedValue({ id: "project" });
  db.project.findUnique.mockResolvedValue({ id: "project", tenantId: "tenant" });
  db.$queryRaw.mockResolvedValue([{ id: "issue" }]);
  db.$transaction.mockImplementation((run) => run(db));
  db.issueClaim.findFirst.mockResolvedValue(claim);
  db.issueClaim.findMany.mockResolvedValue([{ id: "claim", bugId: "issue" }]);
  db.issueClaim.update.mockResolvedValue({ ...claim, lastHeartbeatAt: now });
  db.issueClaim.count.mockResolvedValue(0);
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.budget.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.useRealTimers());

describe("claim heartbeats", () => {
  it("advances the claiming agent's timestamp under the scoped issue lock", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(db.issueClaim.update).toHaveBeenCalledWith({ where: { id: "claim" }, data: { lastHeartbeatAt: now } });
    const [sql, ...values] = db.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain("FOR NO KEY UPDATE");
    expect(values).toEqual(["issue", "tenant", "project"]);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.issueClaim.findFirst.mock.invocationCallOrder[0]);
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "claims.heartbeat", payload: { status: 200 } }) });
  });
  it("rejects another agent, offered claims, and absent/released claims", async () => {
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, agentId: "other" });
    expect((await POST(request(), context)).status).toBe(403);
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, status: "offered" });
    expect((await POST(request(), context)).status).toBe(409);
    db.issueClaim.findFirst.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(409);
    expect(db.issueClaim.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { bugId: "issue", releasedAt: null } }));
    expect(db.issueClaim.update).not.toHaveBeenCalled();
  });
  it("enforces authentication, contributor level, project scope and write budget", async () => {
    expect((await POST(request("", false), context)).status).toBe(401);
    const key = await db.agentApiKey.findUnique();
    db.agentApiKey.findUnique.mockResolvedValueOnce({ ...key, agent: { ...key.agent, level: "observer" } });
    expect((await POST(request(), context)).status).toBe(403);
    expect((await POST(request(""), context)).status).toBe(400);
    db.project.findFirst.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(404);
    mocks.budget.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 7 });
    const response = await POST(request(), context);
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("7");
    expect(mocks.budget).toHaveBeenCalledWith({ id: "agent", burst: false }, "write");
    expect(db.issueClaim.update).not.toHaveBeenCalled();
  });
  it("hides out-of-scope issues and reports storage failures", async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    expect((await POST(request(), context)).status).toBe(404);
    db.$queryRaw.mockRejectedValueOnce(new Error("offline"));
    expect((await POST(request(), context)).status).toBe(503);
  });
});

describe("stale claim release", () => {
  it("releases a silent active claim and conditionally reopens its issue atomically with audit", async () => {
    expect(await releaseStaleClaims("project")).toEqual({ released: 1 });
    expect(db.issueClaim.update).toHaveBeenCalledWith({ where: { id: "claim" }, data: { status: "released", releasedAt: now, releaseReason: "silence" } });
    expect(db.bug.updateMany).toHaveBeenCalledWith({ where: { id: "issue", projectId: "project", tenantId: "tenant", isDeleted: false, assigneeId: "owner", status: "in_progress" }, data: { assigneeId: null, status: "open" } });
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "claim.released", agentId: "agent", actorUserId: "admin", bugId: "issue", payload: { claimId: "claim", reason: "silence", projectId: "project" } }) });
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.issueClaim.findFirst.mock.invocationCallOrder[0]);
  });
  it.each([cutoff, new Date(cutoff.getTime() + 1), now])("keeps a heartbeat at or after the 15-minute boundary (%s)", async (lastHeartbeatAt) => {
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, lastHeartbeatAt });
    expect(await releaseStaleClaims("project")).toEqual({ released: 0 });
    expect(db.issueClaim.update).not.toHaveBeenCalled();
  });
  it("starts the clock at activation when no heartbeat exists, never the offer time", async () => {
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, lastHeartbeatAt: null, claimedAt: cutoff, offeredAt: stale });
    expect(await releaseStaleClaims("project")).toEqual({ released: 0 });
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, lastHeartbeatAt: null });
    expect(await releaseStaleClaims("project")).toEqual({ released: 1 });
    db.issueClaim.findFirst.mockResolvedValueOnce({ ...claim, lastHeartbeatAt: null, claimedAt: null, createdAt: stale });
    expect(await releaseStaleClaims("project")).toEqual({ released: 0 });
  });
  it("limits candidates to stale active claims in the project, excluding offers", async () => {
    await releaseStaleClaims("project");
    expect(db.issueClaim.findMany).toHaveBeenCalledWith({ where: { status: "active", releasedAt: null, bug: { projectId: "project", tenantId: "tenant", isDeleted: false }, OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, claimedAt: { lt: cutoff } }] }, select: { id: true, bugId: true } });
  });
  it("preserves a newer claim and skips claims already released by another sweep", async () => {
    db.issueClaim.count.mockResolvedValueOnce(1);
    expect(await releaseStaleClaims("project")).toEqual({ released: 1 });
    expect(db.bug.updateMany).not.toHaveBeenCalled();
    db.issueClaim.findFirst.mockResolvedValueOnce(null);
    expect(await releaseStaleClaims("project")).toEqual({ released: 0 });
  });
  it("requires super-admin authorization before reading claims", async () => {
    mocks.admin.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(releaseStaleClaims("project")).rejects.toThrow("Forbidden");
    expect(db.project.findUnique).not.toHaveBeenCalled();
    expect(db.issueClaim.findMany).not.toHaveBeenCalled();
  });
  it("rejects an unknown project without a sweep", async () => {
    db.project.findUnique.mockResolvedValueOnce(null);
    await expect(releaseStaleClaims("missing")).rejects.toMatchObject({ status: 404 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("propagates audit failure so the transaction rolls back", async () => {
    db.agentAuditEvent.create.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(releaseStaleClaims("project")).rejects.toThrow("audit unavailable");
  });
});
