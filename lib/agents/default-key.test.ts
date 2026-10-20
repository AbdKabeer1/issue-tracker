import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  agent: { create: vi.fn(), findFirst: vi.fn() },
  agentApiKey: { create: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  membership: { findUnique: vi.fn() },
  project: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { PERSONAL_AGENT_NAME, ensureDefaultProjectKey } from "./default-key";
import { hashSecret } from "./keys";
import { openSecret, sealSecret } from "@/lib/secret-box";

const input = { userId: "ada", tenantId: "tenant_ziki", projectId: "project_web" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret-at-least-16";
  db.membership.findUnique.mockResolvedValue({ userId: "ada" });
  db.project.findFirst.mockResolvedValue({ id: "project_web" });
  db.agent.findFirst.mockResolvedValue(null);
  db.agent.create.mockResolvedValue({ id: "agent1" });
  db.agentAuditEvent.create.mockResolvedValue({ id: "audit1" });
});

describe("ensureDefaultProjectKey", () => {
  it("creates a contributor agent and seals the key", async () => {
    const result = await ensureDefaultProjectKey(input);
    expect(result).toMatchObject({ projectId: "project_web", agentId: "agent1" });
    if (!result) return;
    const { data } = db.agent.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant_ziki",
      ownerUserId: "ada",
      name: PERSONAL_AGENT_NAME,
      level: "contributor",
      defaultProjectId: "project_web",
    });
    expect(data.apiKeys.create).toMatchObject({
      projectId: "project_web",
      keyHash: hashSecret(result.rawKey),
      prefix: result.prefix,
    });
    expect(openSecret(data.apiKeys.create.sealedKey)).toBe(result.rawKey);
    expect(db.agentAuditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "agent.created",
      actorUserId: "ada",
    });
  });

  it("opens the same sealed key on the next visit", async () => {
    const sealedKey = sealSecret("ziki_existing_key");
    db.agent.findFirst.mockResolvedValue({
      id: "agent1",
      apiKeys: [{ prefix: "ziki_exist", sealedKey }],
    });
    await expect(ensureDefaultProjectKey(input)).resolves.toEqual({
      projectId: "project_web",
      agentId: "agent1",
      rawKey: "ziki_existing_key",
      prefix: "ziki_exist",
    });
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
  });

  it("does not replace a live key that cannot be opened", async () => {
    db.agent.findFirst.mockResolvedValue({
      id: "agent1",
      apiKeys: [{ prefix: "ziki_exist", sealedKey: null }],
    });
    await expect(ensureDefaultProjectKey(input)).resolves.toBeNull();
    db.agent.findFirst.mockResolvedValue({
      id: "agent1",
      apiKeys: [{ prefix: "ziki_exist", sealedKey: "not-a-seal" }],
    });
    await expect(ensureDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
  });

  it("issues a new sealed key when the personal agent has none", async () => {
    db.agent.findFirst.mockResolvedValue({ id: "agent1", apiKeys: [] });
    const result = await ensureDefaultProjectKey(input);
    expect(result?.agentId).toBe("agent1");
    expect(db.agent.create).not.toHaveBeenCalled();
    const stored = db.agentApiKey.create.mock.calls[0][0].data;
    expect(openSecret(stored.sealedKey)).toBe(result?.rawKey);
    expect(stored.projectId).toBe("project_web");
    expect(db.agentAuditEvent.create.mock.calls[0][0].data.action).toBe("agent.key_rotated");
  });

  it("creates nothing for a non-member or a project outside the workspace", async () => {
    db.membership.findUnique.mockResolvedValue(null);
    await expect(ensureDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.project.findFirst).not.toHaveBeenCalled();

    db.membership.findUnique.mockResolvedValue({ userId: "ada" });
    db.project.findFirst.mockResolvedValue(null);
    await expect(ensureDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.create).not.toHaveBeenCalled();
  });

  it("returns the key another request created first", async () => {
    const sealedKey = sealSecret("ziki_raced_key");
    db.agent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "agent1", apiKeys: [{ prefix: "ziki_raced", sealedKey }] });
    db.agent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );
    await expect(ensureDefaultProjectKey(input)).resolves.toEqual({
      projectId: "project_web",
      agentId: "agent1",
      rawKey: "ziki_raced_key",
      prefix: "ziki_raced",
    });
  });

  it("rethrows a database error that is not a unique race", async () => {
    db.agent.create.mockRejectedValue(new Error("db down"));
    await expect(ensureDefaultProjectKey(input)).rejects.toThrow("db down");
  });
});
