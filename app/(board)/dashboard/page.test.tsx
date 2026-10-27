// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  currentTenantAccess: vi.fn(),
  loadSignalBrief: vi.fn(),
  loadSignalChannels: vi.fn(),
  loadSignalDecisions: vi.fn(),
  loadSignalWorkforce: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/tenant-access", () => ({ currentTenantAccess: mocks.currentTenantAccess }));
vi.mock("@/lib/signal-board", () => ({
  loadSignalBrief: mocks.loadSignalBrief,
  loadSignalChannels: mocks.loadSignalChannels,
  loadSignalDecisions: mocks.loadSignalDecisions,
  loadSignalWorkforce: mocks.loadSignalWorkforce,
  parseSignalView: (raw: string | null | undefined) =>
    raw === "mine" || raw === "needs" || raw === "running" || raw === "down" ? raw : "all",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import DashboardPage from "./page";

afterEach(cleanup);

describe("Signal Board dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "u1", name: "Alice", email: "alice@example.com", role: "user" });
    mocks.currentTenantAccess.mockResolvedValue({ tenantId: "t1", admin: true });
    mocks.loadSignalBrief.mockResolvedValue({
      openIssues: 8,
      autoResolved: 2,
      pendingDecisions: 1,
      automationPct: 25,
      highPriority: 3,
    });
    mocks.loadSignalChannels.mockResolvedValue({
      channels: [
        {
          id: "b1",
          number: 1,
          title: "Login button unresponsive",
          status: "in_progress",
          severity: "high",
          voteCount: 3,
          commentCount: 1,
          worker: { id: "a1", name: "relay-04", kind: "bot" },
          stage: "build",
          chainStage: "build",
          state: "working",
          activity: "Reproducing",
          lastSignalAt: new Date().toISOString(),
          hasPendingApproval: false,
        },
      ],
      total: 8,
    });
    mocks.loadSignalDecisions.mockResolvedValue([]);
    mocks.loadSignalWorkforce.mockResolvedValue([]);
  });

  it("loads the requested view and renders the board", async () => {
    const page = await DashboardPage({ searchParams: Promise.resolve({ view: "needs" }) });
    render(page);

    expect(mocks.loadSignalChannels).toHaveBeenCalledWith({
      tenantId: "t1",
      userId: "u1",
      view: "needs",
    });
    expect(screen.getByText("All issues")).toBeTruthy();
    expect(screen.getByText("Login button unresponsive")).toBeTruthy();
    expect(screen.getByRole("link", { name: /view full manifest/i }).getAttribute("href")).toBe(
      "/issues?status=all&project=all",
    );
  });
});
