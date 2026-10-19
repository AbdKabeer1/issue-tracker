import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({
  agentApiKey: { findUnique: vi.fn() }, agentAuditEvent: { create: vi.fn() },
  membership: { findUnique: vi.fn() }, project: { findFirst: vi.fn() },
  bug: { findFirst: vi.fn(), update: vi.fn() }, issueClaim: { count: vi.fn(), create: vi.fn() },
  bugActivity: { createMany: vi.fn() }, issueWatch: { createMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ confirmed: vi.fn(), publish: vi.fn(), budget: vi.fn(), redesign: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agent-api/validation", () => ({ isConfirmed: mocks.confirmed }));
vi.mock("@/lib/agent-api/events", () => ({ publish: mocks.publish }));
vi.mock("@/lib/redesigns", () => ({ assertRedesignOpen: mocks.redesign }));
vi.mock("@/lib/agents/rate-budget", async (original) => ({ ...await original<typeof import("@/lib/agents/rate-budget")>(), consumeAgentBudget: mocks.budget }));
import { POST } from "@/app/api/v1/issues/[id]/claim/route";
import { IssueApiError } from "@/lib/agent-api/issues";
const context = { params: Promise.resolve({ id: "issue-a" }) };
function request(body: unknown = {}, query = "?projectId=project-a", withKey = true) {
  return new NextRequest(`http://localhost/api/v1/issues/issue-a/claim${query}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(withKey ? { authorization: "Bearer ziki_test" } : {}) }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  db.agentApiKey.findUnique.mockResolvedValue({ id: "key-a", revokedAt: null, agent: { id: "agent-a", name: "Agent", ownerUserId: "owner-a", tenantId: "tenant-a", level: "contributor", burst: false, revokedAt: null, owner: { memberships: [{ tenantId: "tenant-a" }] } } });
  db.project.findFirst.mockResolvedValue({ id: "project-a" });
  db.membership.findUnique.mockResolvedValue({ userId: "owner-a" });
  db.$queryRaw.mockResolvedValue([{ id: "owner-a", name: "Person" }]);
  db.bug.findFirst.mockResolvedValue({ id: "issue-a", status: "open", assigneeId: null, assignee: null });
  db.bug.update.mockResolvedValue({ id: "issue-a", status: "in_progress", assigneeId: "owner-a" });
  db.issueClaim.count.mockResolvedValue(0);
  db.issueClaim.create.mockResolvedValue({ id: "claim-a", bugId: "issue-a", agentId: "agent-a", beneficiaryUserId: "owner-a" });
  db.$transaction.mockImplementation((run) => run(db));
  mocks.confirmed.mockResolvedValue(true);
  mocks.budget.mockResolvedValue({ allowed: true });
});

describe("agent claim route", () => {
  it("requires a valid contributor key", async () => {
    expect((await POST(request({}, "", false), context)).status).toBe(401);
    const key = await db.agentApiKey.findUnique();
    db.agentApiKey.findUnique.mockResolvedValueOnce({ ...key, agent: { ...key.agent, level: "observer" } });
    expect((await POST(request(), context)).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "claims.create", payload: { status: 403 } }) });
  });
  it("records the owner and agent, assigns the issue, logs activity and publishes", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(db.issueClaim.create).toHaveBeenCalledWith({ data: expect.objectContaining({ bugId: "issue-a", beneficiaryUserId: "owner-a", agentId: "agent-a", status: "active", claimedAt: expect.any(Date) }) });
    expect(db.bug.update).toHaveBeenCalledWith(expect.objectContaining({ data: { assigneeId: "owner-a", status: "in_progress" } }));
    expect(mocks.confirmed).toHaveBeenCalledWith("issue-a", db);
    expect(mocks.redesign).toHaveBeenCalledWith("issue-a", db);
    expect(db.bugActivity.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ type: "assignee_changed" }), expect.objectContaining({ type: "status_changed" })]) });
    expect(db.issueWatch.createMany).toHaveBeenCalledWith({ data: [{ userId: "owner-a", bugId: "issue-a", watching: true }], skipDuplicates: true });
    expect(mocks.publish).toHaveBeenCalledWith(db, expect.objectContaining({ type: "claim.created", payload: expect.objectContaining({ claimId: "claim-a", beneficiaryUserId: "owner-a" }) }));
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "issue.claimed", bugId: "issue-a" }) });
  });
  it("claims for a named tenant member without assigning the agent owner", async () => {
    expect((await POST(request({ projectId: "project-a", beneficiaryUserId: "person-b" }, ""), context)).status).toBe(201);
    expect(db.membership.findUnique).toHaveBeenCalledWith({ where: { tenantId_userId: { tenantId: "tenant-a", userId: "person-b" } }, select: { userId: true } });
    expect(db.bug.update).toHaveBeenCalledWith(expect.objectContaining({ data: { assigneeId: "person-b", status: "in_progress" } }));
  });
  it("permits a second active claim but rejects a third before any assignment", async () => {
    db.issueClaim.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect((await POST(request(), context)).status).toBe(201);
    db.issueClaim.create.mockClear(); db.bug.update.mockClear(); mocks.publish.mockClear();
    db.issueClaim.count.mockResolvedValueOnce(2);
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("two active claims");
    expect(db.issueClaim.count).toHaveBeenCalledWith({ where: { beneficiaryUserId: "owner-a", releasedAt: null, bug: { tenantId: "tenant-a", projectId: "project-a" } } });
    expect(db.issueClaim.create).not.toHaveBeenCalled();
    expect(db.bug.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("takes person/issue row locks before checking capacity", async () => {
    await POST(request(), context);
    const [personSql, ...personValues] = db.$queryRaw.mock.calls[0];
    const [issueSql, ...issueValues] = db.$queryRaw.mock.calls[1];
    expect(personSql.join("?")).toMatch(/FROM "User".*FOR NO KEY UPDATE/);
    expect(personValues).toEqual(["owner-a"]);
    expect(issueSql.join("?")).toContain('FROM "Bug"');
    expect(issueSql.join("?")).toContain("FOR NO KEY UPDATE");
    expect(issueValues).toEqual(["issue-a", "tenant-a", "project-a"]);
    expect(db.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(db.issueClaim.count.mock.invocationCallOrder[0]);
  });
  it("rejects unconfirmed, non-open, already claimed or differently assigned issues", async () => {
    mocks.confirmed.mockResolvedValueOnce(false);
    expect((await POST(request(), context)).status).toBe(409);
    db.bug.findFirst.mockResolvedValueOnce({ status: "closed" });
    expect((await POST(request(), context)).status).toBe(409);
    db.issueClaim.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect((await POST(request(), context)).status).toBe(409);
    db.bug.findFirst.mockResolvedValueOnce({ status: "open", assigneeId: "another-person", assignee: { name: "Other" } });
    expect((await POST(request(), context)).status).toBe(409);
    expect(db.issueClaim.create).not.toHaveBeenCalled();
  });
  it("hides out-of-scope issues/projects and rejects nonmember beneficiaries", async () => {
    db.project.findFirst.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(404);
    db.membership.findUnique.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(422);
    db.$queryRaw.mockResolvedValueOnce([{ id: "person" }]).mockResolvedValueOnce([]);
    expect((await POST(request(), context)).status).toBe(404);
    expect(db.bug.update).not.toHaveBeenCalled();
  });
  it("validates input and charges the write budget", async () => {
    expect((await POST(request({}, ""), context)).status).toBe(400);
    expect((await POST(request({ status: "closed" }), context)).status).toBe(400);
    mocks.budget.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 7 });
    const limited = await POST(request(), context);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
    expect(mocks.budget).toHaveBeenCalledWith({ id: "agent-a", burst: false }, "write");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("returns a storage error without a successful claim", async () => {
    db.$queryRaw.mockRejectedValueOnce(new Error("DB"));
    expect((await POST(request(), context)).status).toBe(503);
    expect(db.issueClaim.create).not.toHaveBeenCalled();
  });
  it("blocks a pending or rejected redesign before creating a claim", async () => {
    mocks.redesign.mockRejectedValueOnce(new IssueApiError(409, "This redesign is waiting for a person or was rejected."));
    expect((await POST(request(), context)).status).toBe(409);
    expect(db.issueClaim.create).not.toHaveBeenCalled();
    expect(db.bug.update).not.toHaveBeenCalled();
  });
});
