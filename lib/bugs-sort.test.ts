import { describe, expect, it } from "vitest";
import {
  BUG_SORT_OPTIONS,
  DEFAULT_BUG_SORT,
  bugSortDescriptions,
  bugSortLabels,
  compareBugsByLowestVotes,
  compareBugsByNewest,
  compareBugsByPopularity,
  getBugOrderBy,
  parseBugSort,
  sortBugs,
  sortBugsByPopularity,
} from "./bugs-sort";

describe("sort options constants and labels", () => {
  it("includes newest, top_votes, and lowest_votes options", () => {
    expect(BUG_SORT_OPTIONS).toEqual(["newest", "top_votes", "lowest_votes"]);
    expect(DEFAULT_BUG_SORT).toBe("newest");
    expect(bugSortLabels).toEqual({
      newest: "Newest",
      top_votes: "Top Votes",
      lowest_votes: "Lowest Votes",
    });
    expect(bugSortDescriptions).toEqual({
      newest: "newest",
      top_votes: "top votes",
      lowest_votes: "lowest votes",
    });
  });
});

describe("parseBugSort", () => {
  it("defaults to newest when undefined, null, empty, or whitespace", () => {
    expect(parseBugSort(undefined)).toBe("newest");
    expect(parseBugSort(null)).toBe("newest");
    expect(parseBugSort("")).toBe("newest");
    expect(parseBugSort("   ")).toBe("newest");
  });

  it("defaults to newest for unrecognized sort options", () => {
    expect(parseBugSort("invalid")).toBe("newest");
    expect(parseBugSort("random_sort")).toBe("newest");
  });

  it("parses newest variants", () => {
    expect(parseBugSort("newest")).toBe("newest");
    expect(parseBugSort("NEWEST")).toBe("newest");
    expect(parseBugSort("new")).toBe("newest");
  });

  it("parses top_votes variants", () => {
    expect(parseBugSort("top_votes")).toBe("top_votes");
    expect(parseBugSort("top-votes")).toBe("top_votes");
    expect(parseBugSort("top")).toBe("top_votes");
    expect(parseBugSort("votes_desc")).toBe("top_votes");
  });

  it("parses lowest_votes variants", () => {
    expect(parseBugSort("lowest_votes")).toBe("lowest_votes");
    expect(parseBugSort("lowest-votes")).toBe("lowest_votes");
    expect(parseBugSort("lowest")).toBe("lowest_votes");
    expect(parseBugSort("votes_asc")).toBe("lowest_votes");
  });
});

describe("getBugOrderBy", () => {
  it("returns createdAt desc and id desc for newest", () => {
    expect(getBugOrderBy("newest")).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("returns voteCount desc, updatedAt desc, createdAt desc for top_votes", () => {
    expect(getBugOrderBy("top_votes")).toEqual([
      { voteCount: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ]);
  });

  it("returns voteCount asc, updatedAt desc, createdAt desc for lowest_votes", () => {
    expect(getBugOrderBy("lowest_votes")).toEqual([
      { voteCount: "asc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ]);
  });
});

describe("compareBugsByPopularity", () => {
  it("orders higher voteCount first", () => {
    expect(
      compareBugsByPopularity(
        { voteCount: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { voteCount: 5, updatedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });

  it("uses updatedAt as tiebreaker when voteCounts match", () => {
    expect(
      compareBugsByPopularity(
        { voteCount: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
        { voteCount: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("compareBugsByLowestVotes", () => {
  it("orders lower voteCount first", () => {
    expect(
      compareBugsByLowestVotes(
        { voteCount: 5, updatedAt: "2026-01-01T00:00:00.000Z" },
        { voteCount: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });

  it("uses updatedAt as tiebreaker when voteCounts match", () => {
    expect(
      compareBugsByLowestVotes(
        { voteCount: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
        { voteCount: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("compareBugsByNewest", () => {
  it("orders more recent createdAt first", () => {
    expect(
      compareBugsByNewest(
        { createdAt: "2026-01-01T00:00:00.000Z" },
        { createdAt: "2026-01-05T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });

  it("uses id as tiebreaker when createdAt matches", () => {
    expect(
      compareBugsByNewest(
        { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "b", createdAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("sortBugsByPopularity", () => {
  it("returns bugs sorted by votes then updatedAt", () => {
    const sorted = sortBugsByPopularity([
      { id: "a", voteCount: 1, updatedAt: "2026-01-03T00:00:00.000Z" },
      { id: "b", voteCount: 3, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "c", voteCount: 3, updatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "d", voteCount: 0, updatedAt: "2026-01-04T00:00:00.000Z" },
    ]);

    expect(sorted.map((bug) => bug.id)).toEqual(["c", "b", "a", "d"]);
  });
});

describe("sortBugs", () => {
  const sampleBugs = [
    {
      id: "a",
      voteCount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "b",
      voteCount: 5,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "c",
      voteCount: 0,
      createdAt: "2026-01-04T00:00:00.000Z",
      updatedAt: "2026-01-04T00:00:00.000Z",
    },
    {
      id: "d",
      voteCount: 5,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-06T00:00:00.000Z",
    },
  ];

  it("sorts by newest (createdAt descending)", () => {
    const sorted = sortBugs(sampleBugs, "newest");
    expect(sorted.map((b) => b.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("sorts by top_votes (voteCount descending with updatedAt tiebreaker)", () => {
    const sorted = sortBugs(sampleBugs, "top_votes");
    expect(sorted.map((b) => b.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("sorts by lowest_votes (voteCount ascending with updatedAt tiebreaker)", () => {
    const sorted = sortBugs(sampleBugs, "lowest_votes");
    expect(sorted.map((b) => b.id)).toEqual(["c", "a", "d", "b"]);
  });
});
