import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
const db = vi.hoisted(() => ({
  project: { findFirst: vi.fn() }, membership: { findUnique: vi.fn() }, bug: { findFirst: vi.fn() },
  redesignProposal: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  agentApiKey: { findUnique: vi.fn() }, agentAuditEvent: { create: vi.fn() }, $transaction: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ publish: vi.fn(), notify: vi.fn(), session: vi.fn(), tenant: vi.fn(), budget: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agent-api/events", () => ({ publish: mocks.publish }));
vi.mock("@/lib/agent-notifications", () => ({ notifyApprovalNeeded: mocks.notify }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: mocks.session }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: async () => ({ id: "human" }) }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor: mocks.tenant, defaultProjectIdFor: async () => "project" }));
vi.mock("@/lib/agents/rate-budget", async (original) => ({ ...await original<typeof import("@/lib/agents/rate-budget")>(), consumeAgentBudget: mocks.budget }));
import { assertRedesignOpen } from "./redesigns";
import { POST as propose } from "@/app/api/v1/redesigns/route";
import { POST as decide } from "@/app/api/v1/redesigns/[id]/decision/route";
import RedesignsPage from "@/app/(app)/redesigns/page";

const input = { projectId: "project", title: "A better layout", body: "A thoughtful redesign proposal.", onBehalfOfUserId: "beneficiary", bugId: "issue" };
const proposal = { ...input, id: "proposal", tenantId: "tenant", authorAgentId: "agent", status: "proposed" };
const context = { params: Promise.resolve({ id: "proposal" }) };
function request(body: unknown, key = false, origin?: string) {
  return new NextRequest("http://localhost/api/v1/redesigns", { method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(key ? { authorization: "Bearer ziki_test" } : {}), ...(origin ? { origin } : {}) },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  db.project.findFirst.mockResolvedValue({ id: "project" });
  db.membership.findUnique.mockResolvedValue({ userId: "human" });
  db.bug.findFirst.mockResolvedValue({ id: "issue" });
  db.redesignProposal.create.mockResolvedValue(proposal);
  db.redesignProposal.findFirst.mockResolvedValue(proposal);
  db.redesignProposal.findMany.mockResolvedValue([proposal]);
  db.redesignProposal.updateMany.mockResolvedValue({ count: 1 });
  db.redesignProposal.count.mockResolvedValue(0);
  db.agentApiKey.findUnique.mockResolvedValue({ id: "key", revokedAt: null, agent: {
    id: "agent", name: "Helper", ownerUserId: "owner", tenantId: "tenant", level: "contributor", burst: false, revokedAt: null, owner: { memberships: [{ tenantId: "tenant" }] },
  } });
  db.$transaction.mockImplementation((run) => run(db));
  mocks.session.mockResolvedValue({ userId: "human" });
  mocks.tenant.mockResolvedValue("tenant");
  mocks.budget.mockResolvedValue({ allowed: true });
});

describe("redesign proposal creation", () => {
  it("records the agent and beneficiary, emits an event and notifies the person", async () => {
    expect((await propose(request(input, true))).status).toBe(201);
    expect(db.redesignProposal.create).toHaveBeenCalledWith({ data: expect.objectContaining({ authorAgentId: "agent", onBehalfOfUserId: "beneficiary", tenantId: "tenant", status: "proposed" }) });
    expect(mocks.publish).toHaveBeenCalledWith(db, expect.objectContaining({ type: "redesign.proposed", tenantId: "tenant" }));
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ onBehalfOfUserId: "beneficiary", agent: { name: "Helper" } }));
  });
  it("requires a contributor key and valid input", async () => {
    expect((await propose(request(input))).status).toBe(401);
    const key = await db.agentApiKey.findUnique();
    db.agentApiKey.findUnique.mockResolvedValueOnce({ ...key, agent: { ...key.agent, level: "observer" } });
    expect((await propose(request(input, true))).status).toBe(403);
    expect((await propose(request({}, true))).status).toBe(400);
    expect(db.redesignProposal.create).not.toHaveBeenCalled();
  });
  it("checks project, beneficiary membership, and linked issue scope", async () => {
    db.project.findFirst.mockResolvedValueOnce(null);
    expect((await propose(request(input, true))).status).toBe(404);
    db.membership.findUnique.mockResolvedValueOnce(null);
    expect((await propose(request(input, true))).status).toBe(422);
    db.bug.findFirst.mockResolvedValueOnce(null);
    expect((await propose(request(input, true))).status).toBe(404);
    expect(db.bug.findFirst).toHaveBeenCalledWith({ where: { id: "issue", tenantId: "tenant", projectId: "project", isDeleted: false }, select: { id: true } });
    expect(db.redesignProposal.create).not.toHaveBeenCalled();
  });
});

describe("human approval rule", () => {
  it("refuses agent keys even with a valid human session", async () => {
    expect((await decide(request({ decision: "approved" }, true), context)).status).toBe(403);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(db.redesignProposal.updateMany).not.toHaveBeenCalled();
  });
  it("requires a current session, tenant membership, same origin and valid decision", async () => {
    mocks.session.mockResolvedValueOnce({ error: "expired" });
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(401);
    mocks.tenant.mockResolvedValueOnce(null);
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(403);
    expect((await decide(request({ decision: "approved" }, false, "https://other.test"), context)).status).toBe(403);
    expect((await decide(request({ decision: "anything" }), context)).status).toBe(400);
    db.membership.findUnique.mockResolvedValueOnce(null);
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(403);
    expect(db.redesignProposal.updateMany).not.toHaveBeenCalled();
  });
  it("records the approver/time, audit and event atomically", async () => {
    const response = await decide(request({ decision: "approved" }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(db.redesignProposal.updateMany).toHaveBeenCalledWith({ where: { id: "proposal", tenantId: "tenant", status: "proposed" }, data: { status: "approved", approverId: "human", approvedAt: expect.any(Date) } });
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "redesign.approved", actorUserId: "human", agentId: "agent" }) });
    expect(mocks.publish).toHaveBeenCalledWith(db, expect.objectContaining({ type: "redesign.approved", payload: expect.objectContaining({ actorUserId: "human" }) }));
  });
  it("lets a person reject without recording approval", async () => {
    expect((await decide(request({ decision: "rejected" }), context)).status).toBe(200);
    expect(db.redesignProposal.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "rejected", approverId: null, approvedAt: null } }));
  });
  it("hides other tenants and prevents conflicting decisions", async () => {
    db.redesignProposal.findFirst.mockResolvedValueOnce(null);
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(404);
    db.redesignProposal.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(409);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(db.redesignProposal.findFirst).toHaveBeenCalledWith({ where: { id: "proposal", tenantId: "tenant" } });
  });
  it("returns a storage failure without a successful decision", async () => {
    db.redesignProposal.findFirst.mockRejectedValueOnce(new Error("DB"));
    expect((await decide(request({ decision: "approved" }), context)).status).toBe(503);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});

describe("claim gate and human page", () => {
  it("blocks pending/rejected redesigns and allows an approved or unlinked issue", async () => {
    db.redesignProposal.count.mockResolvedValueOnce(1);
    await expect(assertRedesignOpen("issue", db as never)).rejects.toThrow("waiting for a person");
    await expect(assertRedesignOpen("issue", db as never)).resolves.toBeUndefined();
    expect(db.redesignProposal.count).toHaveBeenCalledWith({ where: { bugId: "issue", status: { not: "approved" } } });
  });
  it("shows the pending state in the active project's tenant-scoped page", async () => {
    const html = renderToStaticMarkup(await RedesignsPage());
    expect(html).toContain("waiting for a person");
    expect(html).toContain("/redesigns/proposal");
    expect(db.redesignProposal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", projectId: "project" } }));
  });
});
