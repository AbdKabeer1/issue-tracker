import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const sweep = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent-api/availability", () => ({ sweepStaleClaims: sweep }));
import { POST } from "./route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
const request = (key?: string) => new NextRequest("http://localhost/api/v1/claims/dispatch", { method: "POST", headers: key ? { authorization: `Bearer ${key}` } : {} });
describe("claim sweep authorization", () => {
  it("fails closed without configuration, with no key, and with an agent key", async () => {
    vi.stubEnv("CLAIM_DISPATCH_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("CLAIM_DISPATCH_SECRET", "scheduler-test-secret");
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("ziki_agent-key"))).status).toBe(401);
    expect(sweep).not.toHaveBeenCalled();
  });
  it("sweeps with the scheduler secret and preserves failures for retry", async () => {
    vi.stubEnv("CLAIM_DISPATCH_SECRET", "scheduler-test-secret");
    sweep.mockResolvedValueOnce({ released: 3, offered: 2 });
    const response = await POST(request("scheduler-test-secret"));
    expect(await response.json()).toEqual({ released: 3, offered: 2 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    sweep.mockRejectedValueOnce(new Error("DB"));
    expect((await POST(request("scheduler-test-secret"))).status).toBe(503);
  });
});
