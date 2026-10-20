import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const count = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());
const projectFindFirst = vi.hoisted(() => vi.fn(async () => null));
const currentTenantIdFor = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "dave" } })) }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn(async () => ({ id: "dave", role: "user" })) }));
vi.mock("@/lib/tenant-access", () => ({ currentTenantAccess: vi.fn(async () => ({ membershipRole: "owner" })) }));
vi.mock("@/lib/project-context", () => ({ activeProjectIdFor: vi.fn(async () => "project-acme") }));
vi.mock("@/lib/lookups", () => ({ getIssueTypes: vi.fn(async () => []), getPlatforms: vi.fn(async () => []) }));
vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-context")>()),
  currentTenantIdFor,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    bug: { count, findMany, groupBy: vi.fn(async () => []) },
    milestone: { findMany: vi.fn(async () => []) },
  },
}));

import BugsPage from "./page";

/** What Postgres says mid-migration, before the tenant column exists. */
function missingTenantColumn() {
  return Object.assign(new Error('The column `Bug.tenantId` does not exist in the current database.'), {
    code: "P2022",
    meta: { column: "Bug.tenantId" },
  });
}

describe("issue list fails closed (#506)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenantIdFor.mockResolvedValue("tenant-acme");
  });

  it("shows an error instead of retrying without the tenant filter", async () => {
    count.mockRejectedValue(missingTenantColumn());

    const page = (await BugsPage({ searchParams: Promise.resolve({}) })) as ReactElement;
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Issues could not be loaded");
    expect(html).toContain("database finishes upgrading");
    // Every query that ran kept the tenant filter, and no list was fetched.
    for (const [args] of count.mock.calls) {
      expect(args.where).toMatchObject({ tenantId: "tenant-acme" });
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it("still gives someone with no membership an empty board, never other tenants' issues", async () => {
    currentTenantIdFor.mockResolvedValue(null);
    count.mockRejectedValueOnce(missingTenantColumn()).mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await BugsPage({ searchParams: Promise.resolve({}) });
    // Every later query either keeps the empty tenant scope or matches no ids.
    for (const [args] of [...count.mock.calls, ...findMany.mock.calls].slice(1)) {
      const where = args.where ?? {};
      const scoped = "tenantId" in where || (where.id && "in" in where.id && where.id.in.length === 0);
      expect(scoped).toBe(true);
    }
  });

  it("declutters issues list view according to #758", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const pageSource = fs.readFileSync(
      path.resolve(__dirname, "page.tsx"),
      "utf8",
    );

    // Export CSV removed
    expect(pageSource).not.toContain("Export CSV");

    // Boosted badges and BoostTicketButton removed from issues list
    expect(pageSource).not.toContain("<BoostTicketButton");
    expect(pageSource).not.toContain("⚡</span> Boosted");

    // Inline DeleteIssueButton removed from list items
    expect(pageSource).not.toContain("<DeleteIssueButton");

    // Verbose person attribution removed
    expect(pageSource).not.toContain("<span>Reported by</span>");
    expect(pageSource).not.toContain("<span>Assigned to</span>");

    // IssuesSidebar and IssuesSidebarDisclosure removed
    expect(pageSource).not.toContain("<IssuesSidebar");
    expect(pageSource).not.toContain("<IssuesSidebarDisclosure");
  });
});
