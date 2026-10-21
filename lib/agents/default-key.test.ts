import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  agent: { create: vi.fn(), findFirst: vi.fn() },
  agentApiKey: { create: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  membership: { findUnique: vi.fn() },
  project: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { findDefaultProjectKey } from "./default-key";
import { openSecret, sealSecret } from "@/lib/secret-box";

const input = { userId: "ada", tenantId: "tenant_ziki", projectId: "project_web" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret-at-least-16";
  db.membership.findUnique.mockResolvedValue({ userId: "ada" });
  db.project.findFirst.mockResolvedValue({ id: "project_web" });
  db.agent.findFirst.mockResolvedValue(null);
});

describe("findDefaultProjectKey", () => {
  it("opens the person's existing sealed key and creates nothing (#442)", async () => {
    const sealedKey = sealSecret("ziki_existing_key");
    db.agent.findFirst.mockResolvedValue({
      id: "agent1",
      apiKeys: [{ prefix: "ziki_exist", sealedKey }],
    });
    await expect(findDefaultProjectKey(input)).resolves.toEqual({
      projectId: "project_web",
      agentId: "agent1",
      rawKey: "ziki_existing_key",
      prefix: "ziki_exist",
    });
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
    expect(db.agentAuditEvent.create).not.toHaveBeenCalled();
  });

  it("returns null when the person has no agent, creating nothing (#442)", async () => {
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
  });

  it("returns null when the agent has no live key, instead of issuing one (#442)", async () => {
    db.agent.findFirst.mockResolvedValue({ id: "agent1", apiKeys: [] });
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();

    db.agent.findFirst.mockResolvedValue({ id: "agent1", apiKeys: [{ prefix: "ziki_exist", sealedKey: null }] });
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    db.agent.findFirst.mockResolvedValue({ id: "agent1", apiKeys: [{ prefix: "ziki_exist", sealedKey: "not-a-seal" }] });
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.create).not.toHaveBeenCalled();
    expect(db.agentApiKey.create).not.toHaveBeenCalled();
  });

  it("returns null for a non-member or a project outside the workspace (#442)", async () => {
    db.membership.findUnique.mockResolvedValue(null);
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.project.findFirst).not.toHaveBeenCalled();

    db.membership.findUnique.mockResolvedValue({ userId: "ada" });
    db.project.findFirst.mockResolvedValue(null);
    await expect(findDefaultProjectKey(input)).resolves.toBeNull();
    expect(db.agent.findFirst).not.toHaveBeenCalled();
    expect(db.agent.create).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the person's own agent in the project", async () => {
    db.agent.findFirst.mockResolvedValue({ id: "agent1", apiKeys: [{ prefix: "ziki_exist", sealedKey: sealSecret("ziki_k") }] });
    await findDefaultProjectKey(input);
    expect(db.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerUserId: "ada", tenantId: "tenant_ziki", defaultProjectId: "project_web", revokedAt: null }),
      }),
    );
  });
});
