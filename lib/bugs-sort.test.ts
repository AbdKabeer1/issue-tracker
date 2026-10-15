import { describe, expect, it } from "vitest";
import {
  compareBugsByPopularity,
  sortBugsByPopularity,
} from "./bugs-sort";

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
