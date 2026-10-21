import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

/**
 * Renders the whole issue list with a small fake database, so the layout
 * changes from the Oct 20 call (#1054–#1063) are checked on real markup.
 */

const count = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());
const groupBy = vi.hoisted(() => vi.fn(async () => []));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/issues",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "dave" } })) }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn(async () => ({ id: "dave", role: "user" })) }));
vi.mock("@/lib/tenant-access", () => ({ currentTenantAccess: vi.fn(async () => ({ membershipRole: "member" })) }));
vi.mock("@/lib/project-context", () => ({ activeProjectIdFor: vi.fn(async () => "project-acme") }));
vi.mock("@/lib/lookups", () => ({
  getIssueTypes: vi.fn(async () => []),
  getPlatforms: vi.fn(async () => [
    { id: "cat-web", name: "Web", isActive: true },
    { id: "cat-mobile", name: "Mobile", isActive: true },
    { id: "cat-old", name: "Desktop", isActive: false },
  ]),
}));
vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-context")>()),
  currentTenantIdFor: vi.fn(async () => "tenant-acme"),
}));
vi.mock("@/lib/issue-stage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/issue-stage")>()),
  openIssueStages: vi.fn(async () => new Map([["bug-1", "reported"]])),
}));
vi.mock("@/lib/voter-summaries", () => ({
  fetchVoterSummaries: vi.fn(async () =>
    new Map([
      [
        "bug-1",
        {
          likes: { count: 2, voters: [{ id: "a", name: "Ann", image: null }, { id: "b", name: "Ben", image: null }] },
          dislikes: { count: 1, voters: [{ id: "c", name: "Cy", image: null }] },
        },
      ],
    ]),
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: vi.fn(async () => ({ slug: "acme-web", name: "Acme Web", goal: null })) },
    bug: { count, findMany, groupBy },
    milestone: { findMany: vi.fn(async () => []) },
    projectArea: { findMany: vi.fn(async () => []) },
    user: { findUnique: vi.fn(async () => ({ keyboardShortcuts: true })) },
  },
}));

import BugsPage from "./page";

const BUG = {
  id: "bug-1",
  number: 7,
  title: "Login button does nothing",
  status: "open",
  severity: "high",
  voteCount: 2,
  proofLinks: ["https://github.com/acme/web/pull/1", "https://github.com/acme/web/pull/2"],
  isDeleted: false,
  isBoosted: false,
  duplicateOf: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-20T10:00:00Z"),
  type: null,
  reporter: { name: "Rita Reporter", role: "user", image: null },
  assignee: { name: "Bob Builder", role: "user", image: null },
  category: { id: "cat-web", name: "Web" },
  area: null,
  votes: [],
  _count: { comments: 3, attachments: 1 },
};

async function renderList(params: Record<string, string> = {}) {
  const page = (await BugsPage({ searchParams: Promise.resolve(params) })) as ReactElement;
  return renderToStaticMarkup(page);
}

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(1);
  findMany.mockResolvedValue([BUG]);
});

describe("issue list layout", () => {
  it("renders the list with the project as its heading (#1063)", async () => {
    const html = await renderList();
    expect(html).toContain("Login button does nothing");
    expect(html).toMatch(/<h1[^>]*>(<!-- -->)?Acme Web<\/h1>/);
  });

  it("has no second New issue button; the header has it (#1057)", async () => {
    const html = await renderList();
    expect(html).not.toContain('href="/issues/new"');
  });

  it("keeps the empty state free of a second New issue button (#1057)", async () => {
    // The search matches nothing, but the tracker itself isn't empty.
    count.mockImplementation(async (args: { where?: { OR?: unknown } }) => (args?.where?.OR ? 0 : 5));
    findMany.mockResolvedValue([]);
    const html = await renderList({ q: "nothing matches" });
    expect(html).toContain("No issues match these filters.");
    expect(html).not.toContain('href="/issues/new"');
  });

  it("has no stage sidebar beside the list (#1054)", async () => {
    const html = await renderList();
    expect(html).not.toContain('aria-label="Issue stages"');
    expect(html).not.toContain("lg:w-56");
  });

  it("still filters by ?stage= from old links (#1054)", async () => {
    await renderList({ stage: "reported" });
    const listQuery = findMany.mock.calls.at(-1)![0];
    expect(listQuery.where.id).toEqual({ in: ["bug-1"] });
  });

  it("is one centred column without the stats card (#1056)", async () => {
    const html = await renderList();
    expect(html).not.toContain("Total issues");
    expect(html).toMatch(/^<div class="mx-auto w-full max-w-3xl /);
    // The four stats counts are no longer queried.
    const statusOnly = count.mock.calls.filter(([args]) => args?.where?.status === "in_progress");
    expect(statusOnly).toHaveLength(0);
  });
});
