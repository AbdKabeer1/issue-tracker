import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const dispatch = vi.hoisted(() => vi.fn());
const prune = vi.hoisted(() => vi.fn());
vi.mock("@/lib/webhooks/deliver", () => ({ dispatchDueDeliveries: dispatch }));
vi.mock("@/lib/agent-retention", () => ({ pruneAgentRows: prune }));
import { POST } from "./route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
const request = (key?: string) => new NextRequest("http://localhost/api/v1/webhooks/dispatch", { method: "POST", headers: key ? { authorization: `Bearer ${key}` } : {} });
describe("scheduler authorization", () => {
  it("fails closed without configuration, with no key, and with an agent key", async () => {
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "scheduler-test-secret");
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("ziki_agent-key"))).status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
    expect(prune).not.toHaveBeenCalled();
  });
  it("dispatches with the scheduler secret and preserves failures for retry", async () => {
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "scheduler-test-secret");
    dispatch.mockResolvedValueOnce(2);
    prune.mockResolvedValueOnce({ deliveries: 1, events: 0, pairings: 0, auditEvents: 0 });
    const response = await POST(request("scheduler-test-secret"));
    expect(await response.json()).toEqual({ processed: 2 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prune).toHaveBeenCalled();
    dispatch.mockRejectedValueOnce(new Error("DB"));
    expect((await POST(request("scheduler-test-secret"))).status).toBe(503);
  });
  it("sweeps retention after dispatch without failing the response when the sweep errors (#546)", async () => {
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "scheduler-test-secret");
    dispatch.mockResolvedValueOnce(0);
    prune.mockRejectedValueOnce(new Error("DB"));
    const response = await POST(request("scheduler-test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 0 });
  });
});
