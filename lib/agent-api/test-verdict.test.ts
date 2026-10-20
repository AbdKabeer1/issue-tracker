import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

type Row = {
  id: string;
  bugId: string;
  agentId: string;
  onBehalfOfUserId: string;
  goodToMerge: boolean;
  notes: string | null;
};

const state = vi.hoisted(() => ({ verdicts: [] as Row[] }));

const db = vi.hoisted(() => ({
  bug: { findFirst: vi.fn() },
  membership: { findUnique: vi.fn() },
  testVerdict: { findFirst: vi.fn(), create: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  agentEvent: { create: vi.fn() },
  webhookSubscription: { findMany: vi.fn() },
  webhookDelivery: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { submitTestVerdict } from "./test-verdict";

/** An issue Ada filed herself, with no agent and no claim. */
function bugRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bug1",
    tenantId: "tenant_zedu",
    severity: "medium",
    beneficiaryUserId: "ada",
    createdByAgentId: null,
    createdByAgent: null,
    claims: [],
    ...overrides,
  };
}

function reviewer(id: string, ownerId: string, level: "observer" | "contributor" | "reviewer" | "merger" = "reviewer") {
  return { agentId: id, name: id, ownerId, tenantId: "tenant_zedu", level, burst: false, keyId: `key-${id}` };
}

const good = { goodToMerge: true };

beforeEach(() => {
  vi.clearAllMocks();
  state.verdicts = [];
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.bug.findFirst.mockResolvedValue(bugRow());
  db.membership.findUnique.mockResolvedValue({ id: "m1" });
  db.agentEvent.create.mockResolvedValue({ id: "e1" });
  db.webhookSubscription.findMany.mockResolvedValue([]);
  db.testVerdict.findFirst.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
    state.verdicts.find((v) => v.bugId === where.bugId && v.agentId === where.agentId) ?? null,
  );
  db.testVerdict.create.mockImplementation(async ({ data }: { data: Omit<Row, "id"> }) => {
    const row = { id: `tv${state.verdicts.length + 1}`, ...data };
    state.verdicts.push(row);
    return row;
  });
});

describe("submitTestVerdict: who may verdict (#434)", () => {
  it("rejects a contributor before touching the issue", async () => {
    const result = await submitTestVerdict(reviewer("c1", "cara", "contributor"), "bug1", good);
    expect(result).toMatchObject({ status: 403, error: "insufficient_level" });
    expect(db.bug.findFirst).not.toHaveBeenCalled();
  });

  it("is 404 for an issue outside the agent's tenant or deleted", async () => {
    db.bug.findFirst.mockResolvedValue(null);
    expect(await submitTestVerdict(reviewer("r1", "rob"), "bug1", good)).toMatchObject({ status: 404 });
    expect(db.bug.findFirst.mock.calls[0][0].where).toEqual({ id: "bug1", tenantId: "tenant_zedu", isDeleted: false });
  });

  it("rejects the agent holding the active claim", async () => {
    db.bug.findFirst.mockResolvedValue(
      bugRow({ claims: [{ status: "active", releasedAt: null, agentId: "r1", agent: { ownerUserId: "rob" } }] }),
    );
    expect(await submitTestVerdict(reviewer("r1", "rob"), "bug1", good)).toMatchObject({
      status: 403,
      error: "fixer_cannot_verdict",
    });
    expect(state.verdicts).toHaveLength(0);
  });

  it("rejects a reviewer whose owner is the beneficiary, or whose owner is the filing agent's", async () => {
    expect(await submitTestVerdict(reviewer("r3", "ada"), "bug1", good)).toMatchObject({
      status: 403,
      error: "not_independent",
    });
    db.bug.findFirst.mockResolvedValue(bugRow({ createdByAgentId: "f1", createdByAgent: { ownerUserId: "rob" } }));
    expect(await submitTestVerdict(reviewer("r2", "rob"), "bug1", good)).toMatchObject({
      status: 403,
      error: "not_independent",
    });
    expect(state.verdicts).toHaveLength(0);
  });

  it("rejects a reviewer whose owner holds the active claim", async () => {
    db.bug.findFirst.mockResolvedValue(
      bugRow({ claims: [{ status: "active", releasedAt: null, agentId: "w1", agent: { ownerUserId: "rob" } }] }),
    );
    expect(await submitTestVerdict(reviewer("r2", "rob"), "bug1", good)).toMatchObject({
      status: 403,
      error: "not_independent",
    });
  });
});

describe("submitTestVerdict: the body and record (#434)", () => {
  it("records a good-to-merge verdict for the owner", async () => {
    const result = await submitTestVerdict(reviewer("r1", "rob"), "bug1", good);
    expect(result).toMatchObject({ status: 201, verdict: { goodToMerge: true, onBehalfOfUserId: "rob" } });
    expect(state.verdicts[0]).toMatchObject({ bugId: "bug1", agentId: "r1", onBehalfOfUserId: "rob", goodToMerge: true });
  });

  it("requires a boolean goodToMerge", async () => {
    expect(await submitTestVerdict(reviewer("r1", "rob"), "bug1", {})).toMatchObject({
      status: 400,
      field: "goodToMerge",
    });
    expect(await submitTestVerdict(reviewer("r1", "rob"), "bug1", { goodToMerge: "yes" })).toMatchObject({ status: 400 });
  });

  it("acts for the owner unless it names another member of the tenant", async () => {
    db.membership.findUnique.mockResolvedValue(null);
    expect(
      await submitTestVerdict(reviewer("r1", "rob"), "bug1", { ...good, onBehalfOfUserId: "stranger" }),
    ).toMatchObject({ status: 400, field: "onBehalfOfUserId" });
    expect(state.verdicts).toHaveLength(0);
  });

  it("allows one verdict per agent per issue", async () => {
    const rob = reviewer("r1", "rob");
    expect(await submitTestVerdict(rob, "bug1", good)).toMatchObject({ status: 201 });
    expect(await submitTestVerdict(rob, "bug1", good)).toMatchObject({ status: 409, error: "already_verdicted" });
    expect(state.verdicts).toHaveLength(1);
  });

  it("handles concurrent inserts deterministically when unique constraint is hit (#712)", async () => {
    const rob = reviewer("r1", "rob");
    db.testVerdict.findFirst.mockResolvedValueOnce(null);
    db.testVerdict.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );
    const result = await submitTestVerdict(rob, "bug1", good);
    expect(result).toMatchObject({
      status: 409,
      error: "already_verdicted",
      message: "This agent has already reported a verdict on this issue.",
    });
  });

  it("audits and publishes every verdict", async () => {
    await submitTestVerdict(reviewer("r1", "rob"), "bug1", good);
    expect(db.agentAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      agentId: "r1",
      action: "issue.test_verdict",
      target: "bug:bug1",
      bugId: "bug1",
    });
    expect(db.agentEvent.create.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant_zedu",
      type: "issue.test_verdict",
      bugId: "bug1",
    });
  });
});
