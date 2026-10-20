import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const mock = {
    agent: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    agentApiKey: { create: vi.fn(), updateMany: vi.fn() },
    agentAuditEvent: { create: vi.fn() },
    membership: { findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { hashSecret } from "./keys";
import { createAgent, revokeAgent, rotateKey, setAgentBurst, setAgentLevel } from "./registry";

const ada = { id: "ada", role: "user" as const };
const zedu = [{ tenantId: "tenant_zedu", role: "member", tenant: { slug: "zedu" } }];

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.membership.findMany.mockResolvedValue(zedu);
  db.membership.findUnique.mockResolvedValue({ role: "member" });
  db.agent.create.mockImplementation(async ({ data }: { data: { name: string } }) => ({ id: "agent1", name: data.name }));
});

describe("createAgent (#427)", () => {
  it("returns the raw key once and stores only its hash and prefix", async () => {
    const result = await createAgent(ada, { name: "  Ada's   Claude ", model: "Claude" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = db.agent.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant_zedu",
      ownerUserId: "ada",
      name: "Ada's Claude",
      model: "Claude",
      level: "observer",
    });
    const stored = data.apiKeys.create;
    expect(stored).toEqual({ keyHash: hashSecret(result.key.rawKey), prefix: result.key.prefix });
    expect(JSON.stringify(data)).not.toContain(result.key.rawKey);
    expect(db.agentAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      agentId: "agent1",
      action: "agent.created",
      actorUserId: "ada",
    });
  });

  it("lets the owner start an agent as a contributor, but no higher", async () => {
    await createAgent(ada, { name: "Ada's GPT", level: "contributor" });
    expect(db.agent.create.mock.calls[0][0].data.level).toBe("contributor");
    const result = await createAgent(ada, { name: "Ada's GPT", level: "merger" });
    expect(result).toMatchObject({ ok: false, field: "level" });
  });

  it("names the field when the name is missing", async () => {
    expect(await createAgent(ada, { name: " " })).toMatchObject({ ok: false, field: "name" });
    expect(db.agent.create).not.toHaveBeenCalled();
  });

  it("refuses someone who isn't in a tenant", async () => {
    db.membership.findMany.mockResolvedValue([]);
    expect(await createAgent(ada, { name: "Ada's Claude" })).toMatchObject({ ok: false });
    expect(db.agent.create).not.toHaveBeenCalled();
  });
});

const agentRow = { id: "agent1", tenantId: "tenant_zedu", ownerUserId: "ada", revokedAt: null };

describe("revokeAgent and setAgentLevel (#427)", () => {
  it("lets the owner revoke, which revokes every key", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    expect(await revokeAgent(ada, "agent1")).toEqual({ ok: true });
    expect(db.agent.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    expect(db.agentApiKey.updateMany.mock.calls[0][0].where).toEqual({ agentId: "agent1", revokedAt: null });
    expect(db.agentAuditEvent.create.mock.calls[0][0].data.payload).toEqual({ by: "owner" });
  });

  it("lets a tenant admin revoke someone else's agent", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    db.membership.findUnique.mockResolvedValue({ role: "admin" });
    expect(await revokeAgent({ id: "lead", role: "user" }, "agent1")).toEqual({ ok: true });
    expect(db.agentAuditEvent.create.mock.calls[0][0].data.payload).toEqual({ by: "tenant_admin" });
  });

  it("refuses anyone else", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    expect(await revokeAgent({ id: "bob", role: "user" }, "agent1")).toMatchObject({ ok: false });
    expect(db.agent.update).not.toHaveBeenCalled();
  });

  it("lets the owner raise to reviewer but not merger", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    db.agent.findUniqueOrThrow.mockResolvedValue({ level: "observer" });
    expect(await setAgentLevel(ada, "agent1", "reviewer")).toEqual({ ok: true });
    expect(db.agent.update.mock.calls[0][0].data).toEqual({ level: "reviewer" });
    expect(await setAgentLevel(ada, "agent1", "merger")).toMatchObject({ ok: false });
    expect(db.agent.update).toHaveBeenCalledTimes(1);
  });
});

describe("setAgentBurst (#440)", () => {
  it("lets a workspace admin raise the write budget", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    db.membership.findUnique.mockResolvedValue({ role: "admin" });
    db.agent.findUniqueOrThrow.mockResolvedValue({ burst: false });
    expect(await setAgentBurst({ id: "lead", role: "user" }, "agent1", true)).toEqual({ ok: true });
    expect(db.agent.update.mock.calls[0][0].data).toEqual({ burst: true });
  });

  it("lets a site admin raise the budget", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    db.agent.findUniqueOrThrow.mockResolvedValue({ burst: false });
    expect(await setAgentBurst({ id: "ada", role: "admin" }, "agent1", true)).toEqual({ ok: true });
  });

  it("refuses an owner who is not an admin", async () => {
    db.agent.findUnique.mockResolvedValue(agentRow);
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    expect(await setAgentBurst(ada, "agent1", true)).toMatchObject({ ok: false });
    expect(db.agent.update).not.toHaveBeenCalled();
  });
});

describe("rotateKey (#427)", () => {
  const agent = {
    agentId: "agent1",
    name: "Ada's Claude",
    ownerId: "ada",
    tenantId: "tenant_zedu",
    level: "observer" as const,
    burst: false,
    keyId: "key1",
  };

  it("revokes the calling key and issues a new one for the same agent", async () => {
    db.agentApiKey.updateMany.mockResolvedValue({ count: 1 });
    const key = await rotateKey(agent);
    expect(db.agentApiKey.updateMany.mock.calls[0][0].where).toEqual({ id: "key1", agentId: "agent1", revokedAt: null });
    expect(db.agentApiKey.create.mock.calls[0][0].data).toEqual({
      agentId: "agent1",
      keyHash: hashSecret(key.rawKey),
      prefix: key.prefix,
    });
    expect(key.agentId).toBe("agent1");
  });

  it("refuses a key that was already rotated", async () => {
    db.agentApiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(rotateKey(agent)).rejects.toThrow(/already rotated/);
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
  });
});
