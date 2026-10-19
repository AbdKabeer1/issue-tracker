import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { agentApiKey: { findUnique } } }));

import { hashSecret } from "./keys";
import { AgentLevelError } from "./levels";
import { AgentAuthError, agentErrorResponse, requireAgent } from "./require-agent";

const KEY = "ziki_valid-key-for-tests";
const request = (authorization?: string) => ({
  headers: { get: (name: string) => (name === "authorization" ? (authorization ?? null) : null) },
});

function keyRow(overrides: { revokedAt?: Date | null; agent?: Record<string, unknown> } = {}) {
  return {
    id: "key1",
    revokedAt: overrides.revokedAt ?? null,
    agent: {
      id: "agent1",
      name: "Ada's Claude",
      ownerUserId: "ada",
      tenantId: "tenant_zedu",
      level: "contributor",
      burst: false,
      revokedAt: null,
      owner: { memberships: [{ tenantId: "tenant_zedu" }] },
      ...overrides.agent,
    },
  };
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as AgentAuthError;
  }
  throw new Error("expected requireAgent to reject");
}

beforeEach(() => vi.clearAllMocks());

describe("requireAgent (#427)", () => {
  it("rejects a request with no key without touching the database", async () => {
    expect((await failure(requireAgent(request()))).code).toBe("missing_key");
    expect((await failure(requireAgent(request("Basic abc")))).code).toBe("missing_key");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a key that matches nothing", async () => {
    findUnique.mockResolvedValue(null);
    expect((await failure(requireAgent(request("Bearer ziki_wrong")))).code).toBe("invalid_key");
    expect(findUnique.mock.calls[0][0].where).toEqual({ keyHash: hashSecret("ziki_wrong") });
  });

  it("resolves a valid key to the agent, its owner, tenant and level", async () => {
    findUnique.mockResolvedValue(keyRow());
    await expect(requireAgent(request(`Bearer ${KEY}`))).resolves.toEqual({
      agentId: "agent1",
      name: "Ada's Claude",
      ownerId: "ada",
      tenantId: "tenant_zedu",
      level: "contributor",
      burst: false,
      keyId: "key1",
    });
    // Looked up by hash only; the raw key never reaches the query.
    expect(JSON.stringify(findUnique.mock.calls[0][0])).not.toContain(KEY);
  });

  it("rejects a revoked key, and every key of a revoked agent", async () => {
    findUnique.mockResolvedValue(keyRow({ revokedAt: new Date() }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
    findUnique.mockResolvedValue(keyRow({ agent: { revokedAt: new Date() } }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
  });

  it("rejects an agent whose owner has left its tenant", async () => {
    findUnique.mockResolvedValue(keyRow({ agent: { owner: { memberships: [{ tenantId: "other" }] } } }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("invalid_key");
  });

  it("writes nothing", async () => {
    findUnique.mockResolvedValue(keyRow());
    await requireAgent(request(`Bearer ${KEY}`));
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("agentErrorResponse", () => {
  it("is 401 for key problems and 403 for a low level", async () => {
    const unauthorized = agentErrorResponse(new AgentAuthError("missing_key"));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("WWW-Authenticate")).toContain("Bearer");
    const forbidden = agentErrorResponse(new AgentLevelError("reviewer"));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: "insufficient_level", required: "reviewer" });
  });

  it("rethrows anything else", () => {
    expect(() => agentErrorResponse(new Error("db down"))).toThrow("db down");
  });
});
