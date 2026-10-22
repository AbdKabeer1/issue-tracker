import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor: vi.fn() }));
vi.mock("@/lib/dashboard-overview", () => ({ loadOwnAgents: vi.fn() }));

import { resolveSessionUserId } from "@/lib/session-user";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { loadOwnAgents } from "@/lib/dashboard-overview";
import { GET } from "./route";

const session = vi.mocked(resolveSessionUserId);
const tenant = vi.mocked(currentTenantIdFor);
const agents = vi.mocked(loadOwnAgents);

describe("GET /api/dashboard/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a stale or missing session", async () => {
    session.mockResolvedValue({ error: "Session expired, sign in again" });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(agents).not.toHaveBeenCalled();
  });

  it("loads agents for the resolved user, not the raw session id", async () => {
    session.mockResolvedValue({ userId: "real-user" });
    tenant.mockResolvedValue("tenant-1");
    agents.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(agents).toHaveBeenCalledWith({ userId: "real-user", tenantId: "tenant-1" });
    await expect(response.json()).resolves.toEqual({ agents: [] });
  });
});
