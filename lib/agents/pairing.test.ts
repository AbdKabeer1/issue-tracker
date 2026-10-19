import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const mock = {
    agentPairing: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    agent: { create: vi.fn() },
    agentAuditEvent: { create: vi.fn() },
    membership: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return mock;
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { hashSecret, normalizeUserCode } from "./keys";
import { PAIRING_TTL_MS, approvePairing, collectPairing, startPairing } from "./pairing";

const NOW = new Date("2026-10-19T12:00:00Z");
const DEVICE = "d".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.membership.findMany.mockResolvedValue([{ tenantId: "tenant_zedu", role: "member", tenant: { slug: "zedu" } }]);
  db.agent.create.mockResolvedValue({ id: "agent9", name: "Ada's Claude" });
});

describe("startPairing (#427)", () => {
  it("stores only hashes of both codes, for 15 minutes", async () => {
    const result = await startPairing({ name: "Ada's Claude", model: "Claude" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = db.agentPairing.create.mock.calls[0][0];
    expect(data.codeHash).toBe(hashSecret(normalizeUserCode(result.userCode)!));
    expect(data.deviceCodeHash).toBe(hashSecret(result.deviceCode));
    expect(JSON.stringify(data)).not.toContain(result.deviceCode);
    expect(data.expiresAt.getTime() - NOW.getTime()).toBe(PAIRING_TTL_MS);
    expect(data.ownerUserId).toBeUndefined();
  });

  it("needs a name", async () => {
    expect(await startPairing({}, NOW)).toMatchObject({ ok: false });
    expect(db.agentPairing.create).not.toHaveBeenCalled();
  });
});

describe("approvePairing (#427)", () => {
  it("sets the approver as owner, only while nobody has approved it", async () => {
    db.agentPairing.updateMany.mockResolvedValue({ count: 1 });
    db.agentPairing.findUniqueOrThrow.mockResolvedValue({ proposedName: "Ada's Claude" });
    expect(await approvePairing({ id: "ada" }, "abcd-2345", NOW)).toEqual({ ok: true, name: "Ada's Claude" });
    const { where, data } = db.agentPairing.updateMany.mock.calls[0][0];
    expect(where).toEqual({
      codeHash: hashSecret("ABCD2345"),
      approvedAt: null,
      ownerUserId: null,
      expiresAt: { gt: NOW },
    });
    expect(data).toEqual({ ownerUserId: "ada", tenantId: "tenant_zedu", approvedAt: NOW });
  });

  it("fails for a used, expired or unknown code", async () => {
    db.agentPairing.updateMany.mockResolvedValue({ count: 0 });
    expect(await approvePairing({ id: "bob" }, "ABCD-2345", NOW)).toMatchObject({ ok: false });
    expect(await approvePairing({ id: "bob" }, "nonsense", NOW)).toMatchObject({ ok: false });
  });
});

const approved = {
  id: "p1",
  proposedName: "Ada's Claude",
  proposedModel: "Claude",
  expiresAt: new Date(NOW.getTime() + 60_000),
  approvedAt: NOW,
  consumedAt: null,
  ownerUserId: "ada",
  tenantId: "tenant_zedu",
};

describe("collectPairing (#427)", () => {
  it("waits until the owner approves", async () => {
    db.agentPairing.findUnique.mockResolvedValue({ ...approved, approvedAt: null, ownerUserId: null, tenantId: null });
    expect(await collectPairing(DEVICE, NOW)).toEqual({ status: "pending" });
  });

  it("reports an unapproved code as expired after 15 minutes", async () => {
    db.agentPairing.findUnique.mockResolvedValue({
      ...approved,
      approvedAt: null,
      ownerUserId: null,
      tenantId: null,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    expect(await collectPairing(DEVICE, NOW)).toEqual({ status: "expired" });
  });

  it("creates the agent for the approver, as an observer, and returns its key once", async () => {
    db.agentPairing.findUnique.mockResolvedValue(approved);
    db.agentPairing.updateMany.mockResolvedValue({ count: 1 });
    const result = await collectPairing(DEVICE, NOW);
    expect(result.status).toBe("issued");
    expect(db.agentPairing.updateMany.mock.calls[0][0].where).toEqual({ id: "p1", consumedAt: null });
    expect(db.agent.create.mock.calls[0][0].data).toMatchObject({
      ownerUserId: "ada",
      tenantId: "tenant_zedu",
      name: "Ada's Claude",
      level: "observer",
    });
    expect(db.agentPairing.update.mock.calls[0][0].data).toEqual({ agentId: "agent9" });
  });

  it("never issues twice", async () => {
    db.agentPairing.findUnique.mockResolvedValue({ ...approved, consumedAt: NOW });
    expect(await collectPairing(DEVICE, NOW)).toEqual({ status: "used" });
    // Two polls racing past the first check: the guarded update stops one.
    db.agentPairing.findUnique.mockResolvedValue(approved);
    db.agentPairing.updateMany.mockResolvedValue({ count: 0 });
    expect(await collectPairing(DEVICE, NOW)).toEqual({ status: "used" });
    expect(db.agent.create).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed device code without a lookup", async () => {
    expect(await collectPairing(undefined, NOW)).toEqual({ status: "invalid" });
    expect(await collectPairing("short", NOW)).toEqual({ status: "invalid" });
    expect(db.agentPairing.findUnique).not.toHaveBeenCalled();
  });
});
