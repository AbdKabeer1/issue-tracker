import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The raw window-function query behind the vote avatars on every list row
 * (#217). The SQL itself is exercised against the database elsewhere; what
 * is pinned here is the shape it is called with and what comes back.
 */

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import { fetchVoterSummaries, fetchVoterSummary } from "./voter-summaries";

const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  bugId: "b1",
  value: 1,
  userId: "u1",
  name: "Ada",
  image: null,
  total_count: 1,
  rn: 1,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("fetchVoterSummaries", () => {
  it("asks the database nothing when there is nothing to ask about", async () => {
    // Every list render calls this; an empty page must not cost a query.
    await expect(fetchVoterSummaries([])).resolves.toEqual(new Map());
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("ignores empty ids rather than querying for them", async () => {
    await expect(fetchVoterSummaries(["", ""])).resolves.toEqual(new Map());
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("de-duplicates ids before querying", async () => {
    queryRaw.mockResolvedValue([]);
    const result = await fetchVoterSummaries(["b1", "b1", "b2"]);
    // Both ids still get an entry, even with no votes between them.
    expect([...result.keys()].sort()).toEqual(["b1", "b2"]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns an empty summary for a bug nobody voted on", async () => {
    queryRaw.mockResolvedValue([]);
    const result = await fetchVoterSummaries(["b1"]);
    expect(result.get("b1")).toEqual({
      likes: { count: 0, voters: [] },
      dislikes: { count: 0, voters: [] },
    });
  });

  it("separates likes from dislikes and keeps the totals", async () => {
    queryRaw.mockResolvedValue([
      row({ value: 1, userId: "u1", name: "Ada", total_count: 5, rn: 1 }),
      row({ value: 1, userId: "u2", name: "Bea", total_count: 5, rn: 2 }),
      row({ value: -1, userId: "u3", name: "Cal", total_count: 2, rn: 1 }),
    ]);
    const summary = (await fetchVoterSummaries(["b1"])).get("b1")!;
    expect(summary.likes.count).toBe(5);
    expect(summary.dislikes.count).toBe(2);
    expect(summary.likes.voters.map((v) => v.name)).toEqual(["Ada", "Bea"]);
    expect(summary.dislikes.voters.map((v) => v.name)).toEqual(["Cal"]);
  });

  it("keeps each bug's voters to itself", async () => {
    queryRaw.mockResolvedValue([
      row({ bugId: "b1", userId: "u1", name: "Ada", total_count: 1 }),
      row({ bugId: "b2", userId: "u2", name: "Bea", total_count: 1 }),
    ]);
    const result = await fetchVoterSummaries(["b1", "b2"]);
    expect(result.get("b1")!.likes.voters.map((v) => v.name)).toEqual(["Ada"]);
    expect(result.get("b2")!.likes.voters.map((v) => v.name)).toEqual(["Bea"]);
  });
});

describe("fetchVoterSummary", () => {
  it("returns the one bug's summary", async () => {
    queryRaw.mockResolvedValue([row({ total_count: 3 })]);
    const summary = await fetchVoterSummary("b1");
    expect(summary.likes.count).toBe(3);
  });

  it("returns an empty summary rather than undefined for an unknown bug", async () => {
    // The caller renders this straight into the avatars; undefined would
    // crash the issue page rather than show nothing.
    queryRaw.mockResolvedValue([]);
    await expect(fetchVoterSummary("nope")).resolves.toEqual({
      likes: { count: 0, voters: [] },
      dislikes: { count: 0, voters: [] },
    });
  });
});
