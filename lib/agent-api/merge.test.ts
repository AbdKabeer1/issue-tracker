import { beforeEach, describe, expect, it, vi } from "vitest";

type VerdictRow = {
  id: string;
  bugId: string;
  goodToMerge: boolean;
  onBehalfOfUserId: string;
  createdAt: Date;
  agent: { id: string; ownerUserId: string };
};

const state = vi.hoisted(() => ({
  verdicts: [] as VerdictRow[],
  confirmations: [] as { agentId: string; agent: { id: string; ownerUserId: string } }[],
}));

const db = vi.hoisted(() => ({
  bug: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  testVerdict: { findMany: vi.fn() },
  issueValidation: { findMany: vi.fn() },
  pointEntry: { createMany: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  agentEvent: { create: vi.fn() },
  webhookSubscription: { findMany: vi.fn() },
  webhookDelivery: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const redesign = vi.hoisted(() => ({ assertRedesignOpen: vi.fn() }));
vi.mock("@/lib/redesigns", () => ({ assertRedesignOpen: redesign.assertRedesignOpen }));

import { IssueApiError } from "@/lib/agent-api/issues";
import { acceptFix } from "./merge";

function bugRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bug1",
    tenantId: "tenant_zedu",
    severity: "medium",
    status: "open",
    assigneeId: "ada",
    beneficiaryUserId: "ada",
    createdByAgentId: null,
    createdByAgent: null,
    claims: [],
    ...overrides,
  };
}

function merger(id: string, ownerId: string, level: "observer" | "contributor" | "reviewer" | "merger" = "merger") {
  return { agentId: id, name: id, ownerId, tenantId: "tenant_zedu", level, burst: false, keyId: `key-${id}` };
}

/** The two independent accepts that confirm an issue. */
function confirmWith(ownerA: string, ownerB: string) {
  state.confirmations = [
    { agentId: `a-${ownerA}`, agent: { id: `a-${ownerA}`, ownerUserId: ownerA } },
    { agentId: `a-${ownerB}`, agent: { id: `a-${ownerB}`, ownerUserId: ownerB } },
  ];
}

function verdict(agentId: string, ownerId: string, onBehalfOfUserId = ownerId) {
  state.verdicts.push({
    id: `v-${agentId}`,
    bugId: "bug1",
    goodToMerge: true,
    onBehalfOfUserId,
    createdAt: new Date(),
    agent: { id: agentId, ownerUserId: ownerId },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.verdicts = [];
  state.confirmations = [];
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.bug.findFirst.mockResolvedValue(bugRow());
  db.bug.findUnique.mockResolvedValue(bugRow());
  db.bug.update.mockResolvedValue({});
  db.pointEntry.createMany.mockResolvedValue({ count: 1 });
  db.agentEvent.create.mockResolvedValue({ id: "e1" });
  db.webhookSubscription.findMany.mockResolvedValue([]);
  redesign.assertRedesignOpen.mockResolvedValue(undefined);
  db.testVerdict.findMany.mockImplementation(async () =>
    state.verdicts.filter((v) => v.bugId === "bug1" && v.goodToMerge),
  );
  db.issueValidation.findMany.mockImplementation(async () => state.confirmations);
});

describe("acceptFix: who may merge (#434)", () => {
  it("rejects a contributor and a reviewer before touching the issue", async () => {
    expect(await acceptFix(merger("c1", "cara", "contributor"), "bug1")).toMatchObject({
      status: 403,
      error: "insufficient_level",
    });
    expect(await acceptFix(merger("r1", "rob", "reviewer"), "bug1")).toMatchObject({
      status: 403,
      error: "insufficient_level",
    });
    expect(db.bug.findFirst).not.toHaveBeenCalled();
  });

  it("is 404 for an issue outside the agent's tenant", async () => {
    db.bug.findFirst.mockResolvedValue(null);
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 404 });
  });
});

describe("acceptFix: the gate (#434)", () => {
  it("names the missing condition: already accepted", async () => {
    db.bug.findFirst.mockResolvedValue(bugRow({ status: "resolved" }));
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({
      status: 409,
      missing: "already_accepted",
    });
  });

  it("names the missing condition: a redesign is waiting for a person", async () => {
    redesign.assertRedesignOpen.mockRejectedValue(new IssueApiError(409, "This redesign is waiting for a person."));
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 409, missing: "redesign" });
  });

  it("names the missing condition: not confirmed", async () => {
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 409, missing: "confirmation" });
    expect(db.bug.update).not.toHaveBeenCalled();
  });

  it("names the missing condition: fewer than two countable verdicts", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob");
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 409, missing: "verdicts" });
  });

  it("counts two verdicts from the same owner once", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob");
    verdict("r2", "rob");
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 409, missing: "verdicts" });
  });

  it("drops a verdict from the claim holder's side", async () => {
    confirmWith("rob", "sam");
    db.bug.findFirst.mockResolvedValue(
      bugRow({ claims: [{ status: "active", releasedAt: null, agentId: "w1", beneficiaryUserId: "ada", agent: { ownerUserId: "rob" } }] }),
    );
    verdict("r1", "rob");
    verdict("r2", "rob");
    expect(await acceptFix(merger("m1", "mo", "merger"), "bug1")).toMatchObject({ status: 409, missing: "verdicts" });
  });
});

describe("acceptFix: a successful accept (#434)", () => {
  it("resolves the issue and pays the assignee as solver, once", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob");
    verdict("r2", "sam");

    const result = await acceptFix(merger("m1", "mo", "merger"), "bug1");
    expect(result).toMatchObject({ status: 200, accepted: true, solverUserId: "ada" });
    expect(db.bug.update).toHaveBeenCalledWith({ where: { id: "bug1" }, data: { status: "resolved" } });

    const awards = db.pointEntry.createMany.mock.calls.map((call) => call[0].data[0]);
    expect(awards).toContainEqual({
      tenantId: "tenant_zedu",
      userId: "ada",
      bugId: "bug1",
      role: "solver",
      points: 25,
      sourceKey: "solver:bug1:ada",
    });
    expect(awards.filter((a) => a.role === "solver")).toHaveLength(1);
    expect(db.agentAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "issue.accepted",
      target: "bug:bug1",
    });
    expect(db.agentEvent.create.mock.calls[0][0].data).toMatchObject({ type: "issue.accepted", bugId: "bug1" });
  });

  it("pays up to two reviewers, each for the person they acted for", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob", "rob");
    verdict("r2", "sam", "sam");
    verdict("r3", "tia", "tia");

    const result = await acceptFix(merger("m1", "mo", "merger"), "bug1");
    expect(result).toMatchObject({ status: 200, rewardedReviewerUserIds: ["rob", "sam"] });
    const awards = db.pointEntry.createMany.mock.calls.map((call) => call[0].data[0]);
    const reviewerAwards = awards.filter((a) => a.role === "reviewer");
    expect(reviewerAwards).toHaveLength(2);
    expect(reviewerAwards[0]).toMatchObject({ userId: "rob", points: 10, sourceKey: "reviewer:bug1:rob" });
    expect(reviewerAwards[1]).toMatchObject({ userId: "sam", points: 10, sourceKey: "reviewer:bug1:sam" });
  });

  it("pays the active claim's beneficiary rather than the assignee", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob");
    verdict("r2", "sam");
    db.bug.findFirst.mockResolvedValue(
      bugRow({ assigneeId: "ada", claims: [{ status: "active", releasedAt: null, agentId: "w1", beneficiaryUserId: "zoe", agent: { ownerUserId: "zoe" } }] }),
    );

    const result = await acceptFix(merger("m1", "mo", "merger"), "bug1");
    expect(result).toMatchObject({ solverUserId: "zoe" });
    const awards = db.pointEntry.createMany.mock.calls.map((call) => call[0].data[0]);
    expect(awards).toContainEqual(expect.objectContaining({ role: "solver", userId: "zoe", sourceKey: "solver:bug1:zoe" }));
  });

  it("accepts with no solver when nobody is assigned and there is no claim", async () => {
    confirmWith("rob", "sam");
    verdict("r1", "rob");
    verdict("r2", "sam");
    db.bug.findFirst.mockResolvedValue(bugRow({ assigneeId: null }));

    const result = await acceptFix(merger("m1", "mo", "merger"), "bug1");
    expect(result).toMatchObject({ status: 200, solverUserId: null });
    const awards = db.pointEntry.createMany.mock.calls.map((call) => call[0].data[0]);
    expect(awards.some((a) => a.role === "solver")).toBe(false);
  });
});
