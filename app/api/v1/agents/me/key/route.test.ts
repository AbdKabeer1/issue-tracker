import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAgent: vi.fn(),
  rotateKey: vi.fn(),
}));

vi.mock("@/lib/agents/require-agent", async (original) => ({
  ...(await original<typeof import("@/lib/agents/require-agent")>()),
  requireAgent: mocks.requireAgent,
}));
vi.mock("@/lib/agents/registry", () => ({ rotateKey: mocks.rotateKey }));

import { POST } from "./route";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/v1/agents/me/key", { method: "POST", headers });
}

describe("POST /api/v1/agents/me/key (#654)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    mocks.requireAgent.mockResolvedValue({ agentId: "agent1" });
    mocks.rotateKey.mockResolvedValue({ rawKey: "ziki_secret", prefix: "ziki_se" });
  });

  it("rotates when the caller sends no browser origin", async () => {
    const response = await POST(request({ authorization: "Bearer ziki_test" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ api_key: "ziki_secret", key_prefix: "ziki_se" });
    expect(mocks.rotateKey).toHaveBeenCalled();
  });

  it("rejects a cross-site Origin before the key is used", async () => {
    const response = await POST(request({ origin: "https://evil.example", authorization: "Bearer ziki_test" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "csrf" });
    expect(mocks.requireAgent).not.toHaveBeenCalled();
    expect(mocks.rotateKey).not.toHaveBeenCalled();
  });
});
