// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";

const currentTenantIdFor = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const projectContextFor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/project-context", () => ({ projectContextFor }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findMany: vi.fn() },
    projectArea: { findMany: vi.fn() },
    agent: { findMany: vi.fn() },
    issueClaim: { findMany: vi.fn(), groupBy: vi.fn() },
    pointEntry: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import TeamPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "viewer-1" });
  currentTenantIdFor.mockResolvedValue("tenant-1");
  projectContextFor.mockResolvedValue({ activeProjectId: "project-1" });
  vi.mocked(prisma.membership.findMany).mockResolvedValue([
    { role: "member", user: { id: "viewer-1", name: "Ada" } },
    { role: "member", user: { id: "member-2", name: "Grace" } },
  ] as never);
  // Project areas (#609), not platforms: "Web" is the issue's platform.
  vi.mocked(prisma.projectArea.findMany).mockResolvedValue([
    { id: "area-1", name: "Checkout" },
    { id: "area-2", name: "Search" },
  ] as never);
  vi.mocked(prisma.agent.findMany).mockResolvedValue([
    {
      id: "agent-1",
      ownerUserId: "viewer-1",
      name: "Ada's agent",
      model: "Claude",
      level: "reviewer",
      apiKeys: [{ lastUsedAt: null }],
      claims: [{
        claimedAt: new Date(),
        lastHeartbeatAt: new Date(),
        bug: { id: "issue-1", title: "Fix the app", categoryId: "cat-web", category: { name: "Web" }, areaId: "area-1", area: { name: "Checkout" } },
      }],
    },
  ] as never);
  vi.mocked(prisma.issueClaim.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.issueClaim.groupBy).mockResolvedValue([
    { beneficiaryUserId: "viewer-1", _count: { _all: 1 } },
  ] as never);
  vi.mocked(prisma.pointEntry.groupBy).mockResolvedValue([
    { userId: "viewer-1", _sum: { points: 12 } },
  ] as never);
});

describe("team directory page", () => {
  it("renders tenant members, work links, labeled filters, and scoped reads", async () => {
    const page = await TeamPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Ada");
    expect(html).toContain("Online");
    expect(html).toContain("Fix the app");
    expect(html).toContain('href="/issues/issue-1"');
    expect(html).toContain("Online now");
    expect(html).toContain("Has capacity");
    expect(html).toContain("active claims in the selected project");
    expect(html).not.toContain('name="area"');
    expect(prisma.membership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-1" },
    }));
    expect(prisma.issueClaim.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        bug: { tenantId: "tenant-1", projectId: "project-1" },
      }),
    }));
    expect(html).toContain("Grace");
    const documentRoot = new DOMParser().parseFromString(html, "text/html");
    expect([...documentRoot.querySelectorAll(".team-table > thead th")].map((cell) => cell.textContent)).toEqual([
      "Member", "Workspace role", "Points Last 30 days", "Active claims Selected project", "Agents",
    ]);
    expect(documentRoot.querySelectorAll(".team-member-row")).toHaveLength(2);
    const toggle = documentRoot.querySelector('button[aria-controls="team-agents-viewer-1"]');
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    const agentDetails = documentRoot.getElementById("team-agents-viewer-1");
    expect(agentDetails?.hasAttribute("hidden")).toBe(true);
    expect(agentDetails?.querySelector('a[href="/issues/issue-1"]')).not.toBeNull();
    expect(html).toContain("No active agents.");
    expect(html).not.toContain("Role for");
    expect(documentRoot.querySelector(".team-agent-role")?.textContent).toBe("Reviewer");
    expect(prisma.agent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-1", ownerUserId: { in: ["viewer-1", "member-2"] }, revokedAt: null },
    }));
  });

  it("passes the accessibility sweep at desktop and 375px widths", async () => {
    const page = await TeamPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);
    const previousWidth = window.innerWidth;
    window.HTMLCanvasElement.prototype.getContext = (() =>
      ({ font: "", measureText: () => ({ width: 0 }) })) as unknown as typeof window.HTMLCanvasElement.prototype.getContext;

    for (const width of [1280, 375]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      document.body.innerHTML = html;
      const { violations } = await axe.run(document.body, {
        rules: {
          "color-contrast": { enabled: false },
          region: { enabled: false },
        },
      });
      expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    }
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    document.body.innerHTML = "";
  });

  it("filters members by online status and capacity", async () => {
    const page = await TeamPage({
      searchParams: Promise.resolve({ area: "area-1", online: "1", capacity: "1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Ada");
    expect(html).not.toContain("Grace");
    expect(html).toContain("Fix the app");
  });

  it("does not query or display tenant data without a workspace", async () => {
    currentTenantIdFor.mockResolvedValue(null);

    const page = await TeamPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Join or create a workspace");
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
  });

  it("ignores legacy area parameters and no longer queries filter areas", async () => {
    const html = renderToStaticMarkup(await TeamPage({ searchParams: Promise.resolve({ area: "area-2" }) }));
    expect(prisma.projectArea.findMany).not.toHaveBeenCalled();
    expect(html).not.toContain('name="area"');
    expect(html).toContain("Ada");
    expect(html).toContain("Grace");
    expect(html).toContain("Fix the app");
  });

  it("hides the Area filter when there is no active project to take areas from", async () => {
    projectContextFor.mockResolvedValue({ activeProjectId: null });

    const html = renderToStaticMarkup(await TeamPage({ searchParams: Promise.resolve({ area: "area-1" }) }));

    expect(prisma.projectArea.findMany).not.toHaveBeenCalled();
    expect(html).not.toContain('name="area"');
    // An area from an old link is ignored rather than filtering everyone out.
    expect(html).toContain("Ada");
    expect(html).toContain("Grace");
  });

  it("lets a super admin change another person's agent role", async () => {
    requireUser.mockResolvedValue({ id: "viewer-1", role: "super_admin" });
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      {
        id: "agent-2",
        ownerUserId: "member-2",
        name: "Grace's agent",
        model: "Claude",
        level: "triager",
        apiKeys: [{ lastUsedAt: null }],
        claims: [],
      },
    ] as never);

    const html = renderToStaticMarkup(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("change anyone&#x27;s agent role");
    expect(html).toContain('aria-label="Role for Grace&#x27;s agent"');
    expect(html).toContain(">Merger</option>");
    expect(html).toContain(">Dispatcher</option>");
    expect(html).not.toContain("Reputation:");
  });
});
