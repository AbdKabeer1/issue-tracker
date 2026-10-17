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
    expect(DEFAULT_BUG_SORT).toBe("top_votes");
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
  it("defaults to top votes when undefined, null, empty, or whitespace", () => {
    expect(parseBugSort(undefined)).toBe("top_votes");
    expect(parseBugSort(null)).toBe("top_votes");
    expect(parseBugSort("")).toBe("top_votes");
    expect(parseBugSort("   ")).toBe("top_votes");
  });

  it("defaults to top votes for unrecognized sort options", () => {
    expect(parseBugSort("invalid")).toBe("top_votes");
    expect(parseBugSort("random_sort")).toBe("top_votes");
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

  it("handles repeated query parameters as string array without throwing", () => {
    expect(parseBugSort(["newest", "top_votes"])).toBe("newest");
    expect(parseBugSort(["top_votes", "lowest_votes"])).toBe("top_votes");
    expect(parseBugSort(["lowest_votes", "newest"])).toBe("lowest_votes");
    expect(parseBugSort([])).toBe("top_votes");
  });
});

describe("getBugOrderBy", () => {
  it("returns isBoosted desc, boostedAt desc, and createdAt desc for newest", () => {
    expect(getBugOrderBy("newest")).toEqual([
      { isBoosted: "desc" },
      { boostedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("returns isBoosted desc, boostedAt desc, and voteCount desc for top_votes", () => {
    expect(getBugOrderBy("top_votes")).toEqual([
      { isBoosted: "desc" },
      { boostedAt: "desc" },
      { voteCount: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ]);
  });

  it("returns isBoosted desc, boostedAt desc, and voteCount asc for lowest_votes", () => {
    expect(getBugOrderBy("lowest_votes")).toEqual([
      { isBoosted: "desc" },
      { boostedAt: "desc" },
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

  it("always puts boosted tickets at the top regardless of votes or sort option", () => {
    const bugsWithBoost = [
      { id: "regular-high-votes", voteCount: 100, isBoosted: false, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "boosted-low-votes", voteCount: 0, isBoosted: true, boostedAt: "2026-01-10T00:00:00.000Z", createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "regular-recent", voteCount: 5, isBoosted: false, createdAt: "2026-01-20T00:00:00.000Z" },
    ];

    const sortedByVotes = sortBugs(bugsWithBoost, "top_votes");
    expect(sortedByVotes[0].id).toBe("boosted-low-votes");

    const sortedByNewest = sortBugs(bugsWithBoost, "newest");
    expect(sortedByNewest[0].id).toBe("boosted-low-votes");
  });

  it("orders multiple boosted tickets by boostedAt descending", () => {
    const multipleBoosted = [
      { id: "boosted-first", isBoosted: true, boostedAt: "2026-01-01T00:00:00.000Z", voteCount: 10, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "boosted-latest", isBoosted: true, boostedAt: "2026-01-05T00:00:00.000Z", voteCount: 2, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const sorted = sortBugs(multipleBoosted, "top_votes");
    expect(sorted.map((b) => b.id)).toEqual(["boosted-latest", "boosted-first"]);
  });
});
