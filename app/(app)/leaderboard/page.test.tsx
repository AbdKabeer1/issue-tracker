import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const leaderboard = vi.hoisted(() => vi.fn());
const rankFor = vi.hoisted(() => vi.fn());
const totals = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn(async () => ({ id: "ann", role: "user" })) }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor: vi.fn(async () => "tenant-acme") }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/points/leaderboard", () => ({
  DEFAULT_LEADERBOARD_LIMIT: 50,
  paginatedTenantLeaderboard: leaderboard,
  tenantRankFor: rankFor,
  pointTotals: totals,
}));

import LeaderboardPage from "./page";

const row = (
  rank: number,
  overrides: Partial<{ userId: string; name: string; points: number; solvedTasks: number }> = {},
) => ({
  userId: overrides.userId ?? `u${rank}`,
  name: overrides.name ?? `Person ${rank}`,
  image: null,
  points: overrides.points ?? 100 - rank,
  solvedTasks: overrides.solvedTasks ?? 1,
  rank,
});

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup((await LeaderboardPage({ searchParams: Promise.resolve(params) })) as ReactElement);
}

describe("leaderboard pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rankFor.mockResolvedValue(null);
    totals.mockResolvedValue({ points: 0, solvedTasks: 0 });
  });

  it("sends a page past the end to the last page, keeping the page size", async () => {
    // 25 people at 10 a page: 3 pages, so page 99 has no rows.
    leaderboard.mockResolvedValue({ entries: [], total: 25, page: 99, limit: 10, totalPages: 3 });
    await expect(render({ page: "99", limit: "10" })).rejects.toMatchObject({ url: "/leaderboard?page=3&limit=10" });
    expect(redirect).toHaveBeenCalledWith("/leaderboard?page=3&limit=10");
  });

  it("keeps \"No points yet\" for a leaderboard that really is empty", async () => {
    leaderboard.mockResolvedValue({ entries: [], total: 0, page: 1, limit: 50, totalPages: 1 });
    const html = await render({});
    expect(html).toContain("No points yet");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("doesn't redirect an out-of-range page when there is nothing to page through", async () => {
    leaderboard.mockResolvedValue({ entries: [], total: 0, page: 5, limit: 50, totalPages: 1 });
    expect(await render({ page: "5" })).toContain("No points yet");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders a middle page with Previous and Next built the same way", async () => {
    leaderboard.mockResolvedValue({ entries: [row(11), row(12)], total: 25, page: 2, limit: 10, totalPages: 3 });
    const html = await render({ page: "2", limit: "10" });
    expect(html).toContain("Person 11");
    expect(html).toContain("Showing 11–20 of 25");
    expect(html).toContain('href="/leaderboard?page=1&amp;limit=10"');
    expect(html).toContain('href="/leaderboard?page=3&amp;limit=10"');
    expect(html).not.toContain("No points yet");
  });

  it("marks Previous as disabled on the first page", async () => {
    leaderboard.mockResolvedValue({ entries: [row(1)], total: 25, page: 1, limit: 10, totalPages: 3 });
    const html = await render({ limit: "10" });
    expect(html).toMatch(/<span aria-disabled="true"[^>]*>Previous<\/span>/);
  });
});

describe("leaderboard redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rankFor.mockResolvedValue({ rank: 1, total: 3 });
    totals.mockResolvedValue({ points: 516, solvedTasks: 3 });
  });

  it("shows the top-3 podium, your standing, and Points/Solved sort", async () => {
    const top = [
      row(1, { userId: "ann", name: "Ann", points: 516, solvedTasks: 3 }),
      row(2, { name: "Bo", points: 396, solvedTasks: 0 }),
      row(3, { name: "Cy", points: 342, solvedTasks: 5 }),
    ];
    leaderboard.mockResolvedValue({ entries: top, total: 3, page: 1, limit: 50, totalPages: 1 });
    const html = await render({});
    expect(html).toContain("Your standing");
    expect(html).toContain("#1");
    expect(html).toContain("of 3 people");
    expect(html).toContain("120 pts ahead of #2");
    expect(html).toContain("Goal reached · +16");
    expect(html).toContain("Rankings");
    expect(html).toContain('aria-label="Sort by"');
    expect(html).toContain(">Points</a>");
    expect(html).toContain(">Solved</a>");
    expect(html).toContain('href="/leaderboard?page=1&amp;limit=50&amp;sort=solved"');
    expect(html).toContain("Ann");
    expect(html).toContain("Bo");
    expect(html).toContain("Cy");
    expect(html).toContain("You");
  });

  it("re-orders the rankings list when sort=solved", async () => {
    const top = [
      row(1, { userId: "ann", name: "Ann", points: 516, solvedTasks: 3 }),
      row(2, { name: "Bo", points: 396, solvedTasks: 0 }),
      row(3, { name: "Cy", points: 342, solvedTasks: 5 }),
    ];
    leaderboard.mockResolvedValue({ entries: top, total: 3, page: 1, limit: 50, totalPages: 1 });
    const html = await render({ sort: "solved" });
    const rankingsIdx = html.indexOf('aria-label="Rankings"');
    expect(rankingsIdx).toBeGreaterThan(-1);
    const listHtml = html.slice(rankingsIdx);
    const nameOrder = [...listHtml.matchAll(/href="\/users\/[^"]+">([^<]+)</g)].map((m) => m[1]);
    expect(nameOrder).toEqual(["Cy", "Ann", "Bo"]);
  });
});
