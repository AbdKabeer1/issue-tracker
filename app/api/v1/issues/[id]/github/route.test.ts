import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ requireAgent: vi.fn(), budget: vi.fn(), merge: vi.fn() }));

vi.mock("@/lib/agents/require-agent", async (original) => ({
  ...(await original<typeof import("@/lib/agents/require-agent")>()),
  requireAgent: mocks.requireAgent,
}));
vi.mock("@/lib/agents/rate-budget", () => ({
  consumeAgentBudget: mocks.budget,
  agentBudgetExceededResponse: () =>
    new Response(JSON.stringify({ error: "Too many requests." }), { status: 429 }),
}));
vi.mock("@/lib/github/merge-pr", async (original) => ({
  ...(await original<typeof import("@/lib/github/merge-pr")>()),
  mergeAcceptedFix: mocks.merge,
}));

const db = vi.hoisted(() => ({
  bug: { findFirst: vi.fn(), update: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  agentEvent: { create: vi.fn() },
  webhookSubscription: { findMany: vi.fn() },
  webhookDelivery: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { AgentAuthError } from "@/lib/agents/require-agent";
import { POST } from "./route";

const agent = {
  agentId: "c1",
  name: "c1",
  ownerId: "co",
  tenantId: "tenant",
  level: "contributor",
  burst: false,
  keyId: "k",
};
const params = { params: Promise.resolve({ id: "bug1" }) };
const PR_URL = "https://github.com/zedu/web/pull/7";

function request(body: unknown, key = true) {
  return new NextRequest("http://localhost/api/v1/issues/bug1/github", {
    method: "POST",
    headers: {
      ...(key ? { authorization: "Bearer test-key" } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/issues/[id]/github (#452)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
    mocks.requireAgent.mockResolvedValue(agent);
    mocks.budget.mockResolvedValue({ allowed: true });
    mocks.merge.mockResolvedValue({
      status: 200,
      merged: true,
      mergeCommitSha: "merge-sha",
      pullRequestUrl: PR_URL,
    });
    db.bug.findFirst.mockResolvedValue({
      id: "bug1",
      project: { repoUrl: "https://github.com/zedu/web" },
    });
    db.bug.update.mockResolvedValue({});
    db.agentAuditEvent.create.mockResolvedValue({});
    db.agentEvent.create.mockResolvedValue({ id: "event-1" });
    db.webhookSubscription.findMany.mockResolvedValue([]);
  });

  it("links the pull request and merges once the fix is accepted", async () => {
    const response = await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ linked: true, merged: true, mergeCommitSha: "merge-sha" });
    expect(db.bug.update).toHaveBeenCalledWith({
      where: { id: "bug1" },
      data: { pullRequestUrl: PR_URL },
    });
    expect(mocks.merge).toHaveBeenCalledWith(agent, "bug1");
    expect(mocks.budget).toHaveBeenCalledWith({ id: "c1", burst: false }, "write");
  });

  it("links only, without merging, before the fix is accepted", async () => {
    mocks.merge.mockResolvedValue({ status: 409, merged: false, reason: "not_accepted", message: "nope" });
    const response = await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ linked: true, merged: false, reason: "not_accepted" });
    expect(db.bug.update).toHaveBeenCalledTimes(1);
  });

  it("rejects a URL that is not a GitHub pull request", async () => {
    const response = await POST(request({ pullRequestUrl: "https://example.com/x" }), params);
    expect(response.status).toBe(400);
    expect(db.bug.update).not.toHaveBeenCalled();
    expect(mocks.merge).not.toHaveBeenCalled();
  });

  it("rejects a pull request outside the project's repository", async () => {
    const response = await POST(
      request({ pullRequestUrl: "https://github.com/someone/fork/pull/7" }),
      params,
    );
    expect(response.status).toBe(422);
    expect(db.bug.update).not.toHaveBeenCalled();
  });

  it("404s when the issue is not in the agent's tenant", async () => {
    db.bug.findFirst.mockResolvedValue(null);
    const response = await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(response.status).toBe(404);
  });

  it("surfaces a merge failure after linking", async () => {
    mocks.merge.mockResolvedValue({
      status: 409,
      merged: false,
      reason: "checks_failed",
      message: "Checks are not green.",
    });
    const response = await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ linked: true, merged: false, reason: "checks_failed" });
  });

  it("audits the link and rejects a missing key", async () => {
    await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "github.linked" }) }),
    );

    mocks.requireAgent.mockRejectedValue(new AgentAuthError("missing_key"));
    const response = await POST(request({ pullRequestUrl: PR_URL }, false), params);
    expect(response.status).toBe(401);
  });

  it("stops when the write budget is spent", async () => {
    mocks.budget.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 });
    const response = await POST(request({ pullRequestUrl: PR_URL }), params);
    expect(response.status).toBe(429);
    expect(mocks.merge).not.toHaveBeenCalled();
  });
});
