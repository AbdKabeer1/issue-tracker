import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
const currentTenantIdFor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApiKey: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { checkAgentConnectionAction } from "./actions";

describe("checkAgentConnectionAction (#610)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user_1" });
    currentTenantIdFor.mockResolvedValue("tenant_1");
  });

  it("returns connected: false when no active agent key has been used", async () => {
    vi.mocked(prisma.agentApiKey.findFirst).mockResolvedValue(null);

    const result = await checkAgentConnectionAction({ projectId: "proj_1" });
    expect(result.connected).toBe(false);
    expect(result.message).toContain("No agent call detected yet");
  });

  it("returns connected: true when an agent key with lastUsedAt is found", async () => {
    const lastUsed = new Date("2026-10-20T14:00:00Z");
    vi.mocked(prisma.agentApiKey.findFirst).mockResolvedValue({
      id: "key_1",
      agentId: "agent_1",
      lastUsedAt: lastUsed,
      agent: {
        id: "agent_1",
        name: "Test Claude",
        model: "Claude",
      },
    } as unknown as Awaited<ReturnType<typeof prisma.agentApiKey.findFirst>>);

    const result = await checkAgentConnectionAction({
      projectId: "proj_1",
      since: "2026-10-20T13:50:00Z",
    });

    expect(result.connected).toBe(true);
    expect(result.agent?.name).toBe("Test Claude");
    expect(result.agent?.lastUsedAt).toBe(lastUsed.toISOString());
  });

  it("returns error message when user has no active tenant", async () => {
    currentTenantIdFor.mockResolvedValue(null);

    const result = await checkAgentConnectionAction();
    expect(result.connected).toBe(false);
    expect(result.message).toBe("No active workspace found.");
  });
});
