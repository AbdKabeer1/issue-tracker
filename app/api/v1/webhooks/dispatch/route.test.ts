import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/webhooks/deliver", () => ({ dispatchDueDeliveries: dispatch }));
import { GET, POST } from "./route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
const request = (key?: string) => new NextRequest("http://localhost/api/v1/webhooks/dispatch", { method: "POST", headers: key ? { authorization: `Bearer ${key}` } : {} });
const cronRequest = (key?: string) => new NextRequest("http://localhost/api/v1/webhooks/dispatch", { method: "GET", headers: key ? { authorization: `Bearer ${key}` } : {} });
describe("scheduler authorization", () => {
  it("fails closed without configuration, with no key, and with an agent key", async () => {
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "scheduler-test-secret");
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("ziki_agent-key"))).status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("dispatches with the scheduler secret and preserves failures for retry", async () => {
    vi.stubEnv("WEBHOOK_DISPATCH_SECRET", "scheduler-test-secret");
    dispatch.mockResolvedValueOnce(2);
    const response = await POST(request("scheduler-test-secret"));
    expect(await response.json()).toEqual({ processed: 2 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    dispatch.mockRejectedValueOnce(new Error("DB"));
    expect((await POST(request("scheduler-test-secret"))).status).toBe(503);
  });
});

describe("Vercel cron dispatch (#583)", () => {
  it("dispatches GETs authorized with CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    dispatch.mockResolvedValueOnce(3);
    const response = await GET(cronRequest("cron-test-secret"));
    expect(await response.json()).toEqual({ processed: 3 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed without CRON_SECRET, and rejects the scheduler secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(cronRequest("cron-test-secret"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest("scheduler-test-secret"))).status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
