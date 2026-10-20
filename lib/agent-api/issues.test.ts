import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  agentApiKey: { findUnique: vi.fn() }, agentAuditEvent: { create: vi.fn() },
  agentEvent: { create: vi.fn() },
  webhookSubscription: { findMany: vi.fn() }, webhookDelivery: { createMany: vi.fn() },
  project: { findFirst: vi.fn() }, category: { findMany: vi.fn(), findFirst: vi.fn() },
  bug: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  comment: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  membership: { findUnique: vi.fn() }, issueWatch: { upsert: vi.fn() }, bugActivity: { create: vi.fn() },
  idempotencyKey: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  issueType: { findUnique: vi.fn() }, user: { findMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn(),
}));
const budget = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agents/rate-budget", async (original) => ({
  ...await original<typeof import("@/lib/agents/rate-budget")>(), consumeAgentBudget: budget,
}));
import { GET as list, POST as create } from "@/app/api/v1/issues/route";
import { GET as read } from "@/app/api/v1/issues/[id]/route";
import { POST as comment } from "@/app/api/v1/issues/[id]/comments/route";
import { encodeCursor } from "./create-policy";

afterEach(() => vi.restoreAllMocks());

const issue = { id: "issue-a", title: "A distinct issue", createdAt: new Date("2026-10-19T12:00:00Z"), comments: [] };
const context = { params: Promise.resolve({ id: issue.id }) };
const validBody = { projectId: "project-a", title: issue.title, description: "An adequate description of the issue.", acknowledgeSimilar: true };

function request(method = "GET", body?: unknown, query = "?projectId=project-a", key = true) {
  return new NextRequest(`http://localhost/api/v1/issues${query}`, {
    method, headers: { ...(key ? { authorization: "Bearer ziki_test-key" } : {}), "Content-Type": "application/json", "Idempotency-Key": "request-1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.agentEvent.create.mockResolvedValue({ id: "event-a" });
  db.webhookSubscription.findMany.mockResolvedValue([]);
  db.agentApiKey.findUnique.mockResolvedValue({ id: "key-a", revokedAt: null, agent: {
    id: "agent-a", name: "Agent A", ownerUserId: "owner-a", tenantId: "tenant-a", level: "contributor", burst: false, revokedAt: null,
    owner: { memberships: [{ tenantId: "tenant-a" }] },
  } });
  budget.mockResolvedValue({ allowed: true });
  db.project.findFirst.mockResolvedValue({ id: "project-a" });
  db.category.findMany.mockResolvedValue([{ id: "windows", name: "Windows" }]);
  db.category.findFirst.mockResolvedValue({ id: "windows" });
  db.bug.findMany.mockResolvedValue([issue]);
  db.bug.findFirst.mockResolvedValue(issue);
  db.bug.create.mockResolvedValue({ id: issue.id });
  db.membership.findUnique.mockResolvedValue({ userId: "beneficiary-a" });
  db.idempotencyKey.findUnique.mockResolvedValue(null);
  db.idempotencyKey.create.mockResolvedValue({ id: "held-key" });
  db.comment.create.mockResolvedValue({ id: "comment-a", body: "A helpful comment", createdAt: new Date() });
  db.$queryRaw.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (run) => run(db));
});

describe("agent issue API authentication", () => {
  it("fails closed without a key on every route", async () => {
    const responses = await Promise.all([
      list(request("GET", undefined, "", false)), read(request("GET", undefined, "", false), context),
      create(request("POST", validBody, "", false)), comment(request("POST", { body: "hello" }, "", false), context),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
    expect(db.bug.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid/revoked keys and owners who left the tenant", async () => {
    db.agentApiKey.findUnique.mockResolvedValueOnce(null);
    expect((await list(request())).status).toBe(401);
    const key = await db.agentApiKey.findUnique();
    db.agentApiKey.findUnique.mockResolvedValueOnce({ ...key, revokedAt: new Date() });
    expect((await list(request())).status).toBe(401);
    db.agentApiKey.findUnique.mockResolvedValueOnce({ ...key, agent: { ...key.agent, owner: { memberships: [] } } });
    expect((await list(request())).status).toBe(401);
  });

  it("allows observer reads but denies both writes and audits the denials", async () => {
    const key = await db.agentApiKey.findUnique();
    db.agentApiKey.findUnique.mockResolvedValue({ ...key, agent: { ...key.agent, level: "observer" } });
    expect((await list(request())).status).toBe(200);
    expect((await read(request(), context)).status).toBe(200);
    expect((await create(request("POST", validBody))).status).toBe(403);
    expect((await comment(request("POST", { body: "hello" }), context)).status).toBe(403);
    expect(db.bug.create).not.toHaveBeenCalled();
    expect(db.comment.create).not.toHaveBeenCalled();
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "issues.create", payload: { status: 403, request: true } }) }));
  });

  it("uses the shared read/write budgets and preserves Retry-After", async () => {
    await list(request());
    expect(budget).toHaveBeenLastCalledWith({ id: "agent-a", burst: false }, "read");
    budget.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });
    const response = await create(request("POST", validBody));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(budget).toHaveBeenLastCalledWith({ id: "agent-a", burst: false }, "write");
    expect(db.bug.create).not.toHaveBeenCalled();
  });
});

describe("agent issue reads", () => {
  it("combines filters with tenant/project scope and the shared cursor", async () => {
    const cursor = encodeCursor({ id: "previous", createdAt: issue.createdAt });
    const response = await list(request("GET", undefined, `?projectId=project-a&status=open&severity=high&platform=windows&assignee=person-a&limit=1&cursor=${cursor}`));
    expect(response.status).toBe(200);
    expect(db.bug.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", projectId: "project-a", isDeleted: false, status: "open", severity: "high", categoryId: "windows", assigneeId: "person-a",
        OR: [{ createdAt: { lt: issue.createdAt } }, { createdAt: issue.createdAt, id: { lt: "previous" } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2,
    }));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("supports no-platform/no-assignee and the same unknown-platform fallback as the app", async () => {
    await list(request("GET", undefined, "?projectId=project-a&platform=none&assignee=none"));
    expect(db.bug.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ categoryId: null, assigneeId: null }) }));
    await list(request("GET", undefined, "?projectId=project-a&platform=unknown"));
    expect(db.bug.findMany.mock.lastCall?.[0].where).not.toHaveProperty("categoryId");
  });

  it("rejects absent/foreign projects, invalid enums, and malformed cursors", async () => {
    expect((await list(request("GET", undefined, ""))).status).toBe(422);
    db.project.findFirst.mockResolvedValueOnce(null);
    expect((await list(request())).status).toBe(404);
    expect(db.project.findFirst).toHaveBeenCalledWith({ where: { id: "project-a", tenantId: "tenant-a" }, select: { id: true } });
    expect((await list(request("GET", undefined, "?projectId=project-a&status=unknown"))).status).toBe(422);
    expect((await list(request("GET", undefined, "?projectId=project-a&cursor=bad"))).status).toBe(400);
    expect(db.bug.findMany).not.toHaveBeenCalled();
  });

  it("scopes detail reads and hides missing/deleted issues", async () => {
    expect((await read(request(), context)).status).toBe(200);
    expect(db.bug.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a", projectId: "project-a", id: issue.id, isDeleted: false } }));
    db.bug.findFirst.mockResolvedValueOnce(null);
    expect((await read(request(), context)).status).toBe(404);
  });
});

describe("agent issue creation via the real shared create policy", () => {
  it("stores the named person and agent and ignores client severity", async () => {
    const response = await create(request("POST", { ...validBody, beneficiaryUserId: "beneficiary-a", severity: "critical" }));
    expect(response.status).toBe(201);
    expect(db.bug.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      tenantId: "tenant-a", projectId: "project-a", reporterId: "beneficiary-a", beneficiaryUserId: "beneficiary-a", createdByAgentId: "agent-a", severity: "medium", status: "open",
    }) }));
    expect(db.idempotencyKey.update).toHaveBeenCalledWith({ where: { id: "held-key" }, data: { bugId: issue.id } });
    expect(db.agentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      tenantId: "tenant-a", type: "issue.created", actorAgentId: "agent-a", bugId: issue.id,
      payload: { issueId: issue.id, projectId: "project-a", beneficiaryUserId: "beneficiary-a" },
    }) }));
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "issue.created", bugId: issue.id }) }));
  });

  it("defaults the beneficiary to the owner, including when severity is invalid", async () => {
    expect((await create(request("POST", { ...validBody, severity: { arbitrary: true } }, ""))).status).toBe(201);
    expect(db.membership.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId_userId: { tenantId: "tenant-a", userId: "owner-a" } } }));
    expect(db.bug.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ beneficiaryUserId: "owner-a", severity: "medium" }) }));
  });

  it("rejects a nonmember beneficiary and an inactive platform", async () => {
    db.membership.findUnique.mockResolvedValueOnce(null);
    expect((await create(request("POST", validBody))).status).toBe(422);
    db.category.findFirst.mockResolvedValueOnce(null);
    expect((await create(request("POST", { ...validBody, categoryId: "inactive" }))).status).toBe(422);
    expect(db.bug.create).not.toHaveBeenCalled();
  });

  it("requires idempotency, validates JSON, and rejects assignment/status injection", async () => {
    const missing = request("POST", validBody);
    missing.headers.delete("Idempotency-Key");
    expect((await create(missing)).status).toBe(400);
    const malformed = new NextRequest("http://localhost/api/v1/issues", { method: "POST", headers: { authorization: "Bearer ziki_test-key" }, body: "{" });
    expect((await create(malformed)).status).toBe(400);
    for (const extra of [{ status: "closed" }, { assigneeId: "person-a" }]) {
      expect((await create(request("POST", { ...validBody, ...extra }))).status).toBe(422);
    }
    expect(db.bug.create).not.toHaveBeenCalled();
  });

  it("returns the policy's replay without inserting again", async () => {
    db.idempotencyKey.findUnique.mockResolvedValueOnce({ bugId: issue.id, createdAt: new Date() });
    const response = await create(request("POST", validBody));
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
    expect(db.bug.create).not.toHaveBeenCalled();
    expect(db.agentEvent.create).not.toHaveBeenCalled();
  });

  it("does not return a replay from a different project", async () => {
    db.idempotencyKey.findUnique.mockResolvedValueOnce({ bugId: "foreign-issue", createdAt: new Date() });
    db.bug.findFirst.mockResolvedValueOnce(null);
    expect((await create(request("POST", validBody))).status).toBe(404);
  });

  it("returns the shared similar-issue conflict and accepts an explicit acknowledgement", async () => {
    db.$queryRaw.mockResolvedValue([{ ...issue, number: 1, status: "open", voteCount: 0, score: 0.95 }]);
    const response = await create(request("POST", { ...validBody, acknowledgeSimilar: false }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("similar_issues");
    expect(db.bug.create).not.toHaveBeenCalled();
    expect((await create(request("POST", validBody))).status).toBe(201);
  });

  it("returns the shared inactive-type rejection", async () => {
    db.issueType.findUnique.mockResolvedValue({ isActive: false });
    expect((await create(request("POST", { ...validBody, typeId: "inactive" }))).status).toBe(422);
    expect(db.bug.create).not.toHaveBeenCalled();
  });
});

describe("agent comments", () => {
  it("preserves a committed comment response if only the request audit fails (#755)", async () => {
    const error = new Error("Request audit storage unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.agentAuditEvent.create.mockImplementation(async ({ data }) => {
      if (data.action === "comments.create") throw error;
    });

    const response = await comment(request("POST", { body: "A helpful comment" }), context);

    expect(response.status).toBe(201);
    expect((await response.json()).comment.id).toBe("comment-a");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(db.comment.create).toHaveBeenCalledTimes(1);
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "comment.created", bugId: issue.id }),
    }));
    expect(log).toHaveBeenCalledWith("[agent-api] request audit failed", {
      tenantId: "tenant-a", agentId: "agent-a", action: "comments.create",
      target: issue.id, payload: { status: 201, request: true },
    }, error);
  });

  it("keeps transactional domain audit failures fatal (#755)", async () => {
    const error = new Error("Domain audit failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.agentAuditEvent.create.mockImplementation(async ({ data }) => {
      if (data.action === "comment.created") throw error;
      throw new Error("Request audit also failed");
    });
    await expect(comment(request("POST", { body: "A helpful comment" }), context)).rejects.toBe(error);
    expect(log).toHaveBeenCalledWith("[agent-api] request audit failed", expect.objectContaining({
      payload: { status: 500, request: true },
    }), expect.any(Error));
  });

  it("records the person and agent with activity, watching, and audit", async () => {
    expect((await comment(request("POST", { body: "A helpful comment" }), context)).status).toBe(201);
    expect(db.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: { bugId: issue.id, authorId: "owner-a", agentId: "agent-a", body: "A helpful comment", parentId: null } }));
    expect(db.bugActivity.create).toHaveBeenCalled();
    expect(db.agentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      type: "comment.created", bugId: issue.id, payload: { commentId: "comment-a", issueId: issue.id, authorId: "owner-a" },
    }) }));
    expect(db.issueWatch.upsert).toHaveBeenCalled();
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "comment.created", bugId: issue.id }) }));
  });

  it("rejects deleted/out-of-scope issues and parents from other issues", async () => {
    db.bug.findFirst.mockResolvedValueOnce(null);
    expect((await comment(request("POST", { body: "A helpful comment" }), context)).status).toBe(404);
    db.comment.findFirst.mockResolvedValueOnce(null);
    expect((await comment(request("POST", { body: "Reply", parentId: "cl000000000000000000000001" }), context)).status).toBe(422);
    expect(db.comment.create).not.toHaveBeenCalled();
  });

  it("normalizes mentions against tenant members only", async () => {
    db.user.findMany.mockResolvedValue([{ id: "member", name: "Real name" }]);
    await comment(request("POST", { body: "@[Fake](member) @[Other](outsider)" }), context);
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: { in: ["member", "outsider"] }, memberships: { some: { tenantId: "tenant-a" } },
    } }));
    expect(db.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: "@[Real name](member) @Other" }) }));
  });
});
