import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAgent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agents/require-agent", async (original) => ({
  ...(await original<typeof import("@/lib/agents/require-agent")>()),
  requireAgent,
}));

import { GET } from "./route";

describe("GET /api/v1/agents/me (#742)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the project the key is limited to", async () => {
    requireAgent.mockResolvedValue({
      agentId: "agent1",
      name: "Ada's Claude",
      ownerId: "ada",
      tenantId: "tenant_zedu",
      level: "observer",
      projectId: "project_web",
      projectSlug: "web",
    });
    const response = await GET(new NextRequest("http://localhost:3000/api/v1/agents/me"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "agent1",
      name: "Ada's Claude",
      owner_id: "ada",
      tenant_id: "tenant_zedu",
      level: "observer",
      project_id: "project_web",
      project_slug: "web",
    });
  });
});
