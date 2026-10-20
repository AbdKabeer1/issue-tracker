import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  bugId: string;
  agentId: string;
  kind: string;
  verdict: string;
  severity: string | null;
  duplicateOfId: string | null;
  onBehalfOfUserId: string;
};

const state = vi.hoisted(() => ({
  validations: [] as Row[],
  agents: {} as Record<string, { id: string; ownerUserId: string }>,
}));

const db = vi.hoisted(() => ({
  bug: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  membership: { findUnique: vi.fn() },
  issueValidation: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  pointEntry: { createMany: vi.fn() },
  agentAuditEvent: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { isConfirmed, submitValidation } from "./validation";

/** An issue Ada filed herself, with no agent and no claim. */
function bugRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bug1",
    tenantId: "tenant_zedu",
    severity: "medium",
    reporterId: "ada",
    beneficiaryUserId: "ada",
    duplicateOfId: null,
    createdByAgentId: null,
    createdByAgent: null,
    claims: [],
    ...overrides,
  };
}

function reviewer(id: string, ownerId: string, level: "observer" | "contributor" | "reviewer" | "merger" = "reviewer") {
  state.agents[id] = { id, ownerUserId: ownerId };
  return { agentId: id, name: id, ownerId, tenantId: "tenant_zedu", level, burst: false, keyId: `key-${id}` };
}

const acceptReal = { kind: "real", verdict: "accept", severity: "high" };

beforeEach(() => {
  vi.clearAllMocks();
  state.validations = [];
  state.agents = {};
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.bug.findFirst.mockResolvedValue(bugRow());
  db.bug.findUnique.mockResolvedValue(bugRow());
  db.membership.findUnique.mockResolvedValue({ id: "m1" });
  db.pointEntry.createMany.mockResolvedValue({ count: 1 });
  db.agentAuditEvent.findMany.mockResolvedValue([]);
  db.issueValidation.findMany.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
    state.validations
      .filter((v) => v.bugId === where.bugId && v.kind === where.kind && v.verdict === where.verdict)
      .map((v) => ({ id: v.id, agentId: v.agentId, agent: state.agents[v.agentId] })),
  );
  db.issueValidation.count.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
    state.validations.filter((v) => v.bugId === where.bugId && v.kind === where.kind && v.verdict === where.verdict).length,
  );
  db.issueValidation.create.mockImplementation(async ({ data }: { data: Omit<Row, "id"> }) => {
    const duplicate = state.validations.some(
      (v) => v.bugId === data.bugId && v.agentId === data.agentId && v.kind === data.kind,
    );
    if (duplicate) {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" });
    }
    const row = { id: `v${state.validations.length + 1}`, ...data };
    state.validations.push(row);
    return row;
  });
});

describe("submitValidation: who may validate (#433)", () => {
  it("rejects a contributor before touching the issue", async () => {
    const result = await submitValidation(reviewer("c1", "cara", "contributor"), "bug1", acceptReal);
    expect(result).toMatchObject({ status: 403, error: "insufficient_level" });
    expect(db.bug.findFirst).not.toHaveBeenCalled();
  });

  it("rejects the agent that filed the issue", async () => {
    db.bug.findFirst.mockResolvedValue(bugRow({ createdByAgentId: "r1", createdByAgent: { ownerUserId: "rob" } }));
    expect(await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal)).toMatchObject({
      status: 403,
      error: "creator_cannot_validate",
    });
  });

  it("rejects a reviewer that isn't independent: same owner as the filing agent, or the beneficiary's own", async () => {
    db.bug.findFirst.mockResolvedValue(bugRow({ createdByAgentId: "f1", createdByAgent: { ownerUserId: "rob" } }));
    expect(await submitValidation(reviewer("r2", "rob"), "bug1", acceptReal)).toMatchObject({
      status: 403,
      error: "not_independent",
    });
    db.bug.findFirst.mockResolvedValue(bugRow());
    expect(await submitValidation(reviewer("r3", "ada"), "bug1", acceptReal)).toMatchObject({
      status: 403,
      error: "not_independent",
    });
    expect(state.validations).toHaveLength(0);
  });

  it("is 404 for an issue outside the agent's tenant or deleted", async () => {
    db.bug.findFirst.mockResolvedValue(null);
    expect(await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal)).toMatchObject({ status: 404 });
    expect(db.bug.findFirst.mock.calls[0][0].where).toEqual({ id: "bug1", tenantId: "tenant_zedu", isDeleted: false });
  });

  it("allows one validation per agent per kind", async () => {
    const rob = reviewer("r1", "rob");
    expect(await submitValidation(rob, "bug1", acceptReal)).toMatchObject({ status: 201 });
    expect(await submitValidation(rob, "bug1", acceptReal)).toMatchObject({ status: 409, error: "already_validated" });
    expect(await submitValidation(rob, "bug1", { kind: "format", verdict: "accept" })).toMatchObject({ status: 201 });
  });
});

describe("submitValidation: the body (#433)", () => {
  it("requires severity when accepting real, and only then", async () => {
    const rob = reviewer("r1", "rob");
    expect(await submitValidation(rob, "bug1", { kind: "real", verdict: "accept" })).toMatchObject({
      status: 400,
      field: "severity",
    });
    expect(await submitValidation(rob, "bug1", { kind: "format", verdict: "accept", severity: "low" })).toMatchObject({
      status: 400,
      field: "severity",
    });
    expect(await submitValidation(rob, "bug1", { kind: "real", verdict: "maybe" })).toMatchObject({ status: 400 });
  });

  it("sets the issue's severity and keeps the old one for undo", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    expect(db.bug.update).toHaveBeenCalledWith({ where: { id: "bug1" }, data: { severity: "high" } });
    expect(state.validations[0]).toMatchObject({ severity: "high", previousSeverity: "medium" });
  });

  it("lets a duplicate verdict point at the canonical issue in the same tenant", async () => {
    db.bug.findFirst.mockResolvedValueOnce(bugRow()).mockResolvedValueOnce({ id: "bug0" });
    const result = await submitValidation(reviewer("r1", "rob"), "bug1", {
      kind: "duplicate",
      verdict: "accept",
      duplicateOfId: "bug0",
    });
    expect(result).toMatchObject({ status: 201, validation: { duplicateOfId: "bug0" } });
    expect(db.bug.findFirst.mock.calls[1][0].where).toEqual({ id: "bug0", tenantId: "tenant_zedu", isDeleted: false });

    db.bug.findFirst.mockResolvedValue(bugRow());
    expect(
      await submitValidation(reviewer("r2", "sam"), "bug1", { kind: "duplicate", verdict: "accept", duplicateOfId: "bug1" }),
    ).toMatchObject({ status: 400, field: "duplicateOfId" });
  });

  it("acts for the owner unless it names another member of the tenant", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    expect(state.validations[0]?.onBehalfOfUserId).toBe("rob");
    db.membership.findUnique.mockResolvedValue(null);
    expect(
      await submitValidation(reviewer("r2", "sam"), "bug1", { ...acceptReal, onBehalfOfUserId: "stranger" }),
    ).toMatchObject({ status: 400, field: "onBehalfOfUserId" });
  });

  it("audits every submission", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    expect(db.agentAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      agentId: "r1",
      action: "issue.validated",
      target: "bug:bug1",
      bugId: "bug1",
    });
  });
});

describe("confirmation: the two-reviewer rule (#433)", () => {
  it("one accepting reviewer does not confirm; two do, and the reporter is paid once", async () => {
    const first = await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    expect(first).toMatchObject({ status: 201, confirmed: false, newlyConfirmed: false });
    expect(db.pointEntry.createMany).not.toHaveBeenCalled();
    expect(await isConfirmed("bug1")).toBe(false);

    const second = await submitValidation(reviewer("r2", "sam"), "bug1", { ...acceptReal, severity: "low" });
    expect(second).toMatchObject({ status: 201, confirmed: true, newlyConfirmed: true });
    expect(await isConfirmed("bug1")).toBe(true);
    expect(db.pointEntry.createMany).toHaveBeenCalledTimes(1);
    expect(db.pointEntry.createMany.mock.calls[0][0].data[0]).toEqual({
      tenantId: "tenant_zedu",
      userId: "ada",
      bugId: "bug1",
      role: "reporter",
      points: 5,
      sourceKey: "reporter:bug1:ada",
    });

    // A third accept keeps it confirmed and pays nobody again.
    const third = await submitValidation(reviewer("r3", "tia"), "bug1", acceptReal);
    expect(third).toMatchObject({ confirmed: true, newlyConfirmed: false });
    expect(db.pointEntry.createMany).toHaveBeenCalledTimes(1);
  });

  it("two agents of the same owner count once", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    const second = await submitValidation(reviewer("r2", "rob"), "bug1", acceptReal);
    expect(second).toMatchObject({ status: 201, confirmed: false });
  });

  it("rejections and other kinds don't count", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    await submitValidation(reviewer("r2", "sam"), "bug1", { kind: "real", verdict: "reject" });
    await submitValidation(reviewer("r3", "tia"), "bug1", { kind: "format", verdict: "accept" });
    expect(await isConfirmed("bug1")).toBe(false);
  });

  it("drops an accept whose reviewer is no longer independent, e.g. after their owner's agent claimed it", async () => {
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    await submitValidation(reviewer("r2", "sam"), "bug1", acceptReal);
    db.bug.findUnique.mockResolvedValue(
      bugRow({ claims: [{ status: "active", releasedAt: null, agent: { ownerUserId: "sam" } }] }),
    );
    expect(await isConfirmed("bug1")).toBe(false);
  });

  it("pays no reporter points on a duplicate", async () => {
    await submitValidation(reviewer("r3", "tia"), "bug1", { kind: "duplicate", verdict: "accept" });
    await submitValidation(reviewer("r1", "rob"), "bug1", acceptReal);
    const second = await submitValidation(reviewer("r2", "sam"), "bug1", acceptReal);
    expect(second).toMatchObject({ confirmed: true, newlyConfirmed: true });
    expect(db.pointEntry.createMany).not.toHaveBeenCalled();
  });

  it("drops confirmation when an accepting validation is undone (#450)", async () => {
    // r1's validation accepted and confirmed the issue, but is now undone.
    state.validations = [
      { id: "v1", bugId: "bug1", agentId: "r1", kind: "real", verdict: "accept", severity: "high", duplicateOfId: null, onBehalfOfUserId: "rob" },
    ];
    state.agents = { r1: { id: "r1", ownerUserId: "rob" }, r2: { id: "r2", ownerUserId: "sam" } };
    db.agentAuditEvent.findMany.mockResolvedValue([{ payload: { validationId: "v1" }, undoneAt: new Date() }]);

    const result = await submitValidation(reviewer("r2", "sam"), "bug1", acceptReal);
    expect(result).toMatchObject({ status: 201, confirmed: false, newlyConfirmed: false });
  });

  it("isConfirmed is false for an unknown issue", async () => {
    db.bug.findUnique.mockResolvedValue(null);
    expect(await isConfirmed("nope")).toBe(false);
  });
});
