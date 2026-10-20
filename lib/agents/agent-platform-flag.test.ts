import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const findUnique = vi.hoisted(() => vi.fn());
const startPairing = vi.hoisted(() => vi.fn());
const collectPairing = vi.hoisted(() => vi.fn());
const dispatchDueDeliveries = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { agentApiKey: { findUnique, update: vi.fn() } } }));
vi.mock("@/lib/agents/rate-limit", () => ({ consumePairingLimit: vi.fn(async () => null) }));
vi.mock("@/lib/agents/pairing", () => ({
  PAIRING_POLL_INTERVAL: 5,
  pairingApprovalPath: (code: string) => `/settings/agents/pair?code=${code}`,
  startPairing,
  collectPairing,
}));
vi.mock("@/lib/site-url", () => ({ absoluteUrl: (path: string) => `https://ziki.dev${path}` }));
vi.mock("@/lib/webhooks/deliver", () => ({ dispatchDueDeliveries }));

import { AgentPlatformDisabledError, agentErrorResponse, requireAgent } from "./require-agent";
import { POST as startPairingRoute } from "@/app/api/v1/agents/pairing/route";
import { POST as collectPairingRoute } from "@/app/api/v1/agents/pairing/token/route";
import { POST as dispatchRoute } from "@/app/api/v1/webhooks/dispatch/route";

const keyed = { headers: { get: (name: string) => (name === "authorization" ? "Bearer ziki_some-key" : null) } };
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://ziki.dev${path}`, { method: "POST", body: JSON.stringify(body), headers });

describe("AGENT_PLATFORM=false switches the agent API off, not just the pages (#505)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_AGENT_PLATFORM", "false");
    vi.stubEnv("AGENT_PLATFORM", "false");
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "dispatch-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses every key before looking it up", async () => {
    await expect(requireAgent(keyed)).rejects.toBeInstanceOf(AgentPlatformDisabledError);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("answers agent routes with a 404", async () => {
    const response = agentErrorResponse(new AgentPlatformDisabledError());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "agent_platform_disabled" });
  });

  it("won't start or finish a pairing", async () => {
    const started = await startPairingRoute(post("/api/v1/agents/pairing", { name: "Claude" }));
    expect(started.status).toBe(404);
    expect(startPairing).not.toHaveBeenCalled();

    const collected = await collectPairingRoute(post("/api/v1/agents/pairing/token", { device_code: "abc" }));
    expect(collected.status).toBe(404);
    expect(collectPairing).not.toHaveBeenCalled();
  });

  it("won't dispatch webhooks", async () => {
    const response = await dispatchRoute(
      post("/api/v1/webhooks/dispatch", {}, { authorization: "Bearer dispatch-secret" }),
    );
    expect(response.status).toBe(404);
    expect(dispatchDueDeliveries).not.toHaveBeenCalled();
  });

  it("works as before once the flag is back on", async () => {
    vi.stubEnv("NEXT_PUBLIC_AGENT_PLATFORM", "true");
    vi.stubEnv("AGENT_PLATFORM", "true");
    findUnique.mockResolvedValue(null);
    await expect(requireAgent(keyed)).rejects.toMatchObject({ code: "invalid_key" });
    expect(findUnique).toHaveBeenCalled();
  });
});
