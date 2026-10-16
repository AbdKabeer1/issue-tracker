import { describe, expect, it } from "vitest";
import {
  buildVoterSummaries,
  buildVoterSummary,
  createEmptyVoterSummary,
  formatOverflowCount,
  getInitials,
  updateVoteCounts,
  type RawVoterRow,
} from "./voters";

describe("getInitials", () => {
  it("extracts initials from multi-word names", () => {
    expect(getInitials("Goodness Mbakara")).toBe("GM");
    expect(getInitials("John Doe Smith")).toBe("JS");
    expect(getInitials("jane mary doe")).toBe("JD");
  });

  it("extracts initial from single-word names", () => {
    expect(getInitials("Alice")).toBe("A");
    expect(getInitials("bob")).toBe("B");
  });

  it("handles whitespace correctly", () => {
    expect(getInitials("   Goodness    Mbakara   ")).toBe("GM");
  });

  it("returns ? for missing or empty names", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
  });
});

describe("formatOverflowCount", () => {
  it("returns null when count is less than or equal to maxVisible", () => {
    expect(formatOverflowCount(0, 3)).toBeNull();
    expect(formatOverflowCount(1, 3)).toBeNull();
    expect(formatOverflowCount(2, 3)).toBeNull();
    expect(formatOverflowCount(3, 3)).toBeNull();
  });

  it("formats overflow when count exceeds maxVisible", () => {
    expect(formatOverflowCount(4, 3)).toBe("+1");
    expect(formatOverflowCount(5, 3)).toBe("+2");
    expect(formatOverflowCount(500, 3)).toBe("+497");
  });

  it("supports custom maxVisible", () => {
    expect(formatOverflowCount(5, 5)).toBeNull();
    expect(formatOverflowCount(6, 5)).toBe("+1");
  });
});

describe("updateVoteCounts", () => {
  it("adds like from neutral", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, 0, 1);
    expect(res).toEqual({
      likeCount: 6,
      dislikeCount: 2,
      nextVote: 1,
    });
  });

  it("adds dislike from neutral", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, 0, -1);
    expect(res).toEqual({
      likeCount: 5,
      dislikeCount: 3,
      nextVote: -1,
    });
  });

  it("toggles off like", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, 1, 1);
    expect(res).toEqual({
      likeCount: 4,
      dislikeCount: 2,
      nextVote: 0,
    });
  });

  it("toggles off dislike", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, -1, -1);
    expect(res).toEqual({
      likeCount: 5,
      dislikeCount: 1,
      nextVote: 0,
    });
  });

  it("switches from like to dislike", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, 1, -1);
    expect(res).toEqual({
      likeCount: 4,
      dislikeCount: 3,
      nextVote: -1,
    });
  });

  it("switches from dislike to like", () => {
    const res = updateVoteCounts({ likeCount: 5, dislikeCount: 2 }, -1, 1);
    expect(res).toEqual({
      likeCount: 6,
      dislikeCount: 1,
      nextVote: 1,
    });
  });

  it("clamps negative numbers to 0", () => {
    const res = updateVoteCounts({ likeCount: 0, dislikeCount: 0 }, 1, 1);
    expect(res).toEqual({
      likeCount: 0,
      dislikeCount: 0,
      nextVote: 0,
    });
  });
});

describe("buildVoterSummaries", () => {
  it("initializes empty summaries for all requested bugIds", () => {
    const map = buildVoterSummaries([], ["bug-1", "bug-2"]);
    expect(map.get("bug-1")).toEqual(createEmptyVoterSummary());
    expect(map.get("bug-2")).toEqual(createEmptyVoterSummary());
  });

  it("groups up to 3 voters and sets total count", () => {
    const rows: RawVoterRow[] = [
      {
        bugId: "bug-1",
        value: 1,
        userId: "u-1",
        name: "User One",
        image: "https://example.com/1.png",
        total_count: 5,
        rn: 1,
      },
      {
        bugId: "bug-1",
        value: 1,
        userId: "u-2",
        name: "User Two",
        image: null,
        total_count: 5,
        rn: 2,
      },
      {
        bugId: "bug-1",
        value: 1,
        userId: "u-3",
        name: "User Three",
        image: "https://example.com/3.png",
        total_count: 5,
        rn: 3,
      },
      {
        bugId: "bug-1",
        value: -1,
        userId: "u-4",
        name: "User Four",
        image: null,
        total_count: 1,
        rn: 1,
      },
    ];

    const summary = buildVoterSummary(rows);
    expect(summary.likes.count).toBe(5);
    expect(summary.likes.voters).toHaveLength(3);
    expect(summary.likes.voters[0]).toEqual({
      id: "u-1",
      name: "User One",
      image: "https://example.com/1.png",
    });
    expect(summary.dislikes.count).toBe(1);
    expect(summary.dislikes.voters).toHaveLength(1);
  });

  it("handles BigInt total_count and rn from PostgreSQL", () => {
    const rows: RawVoterRow[] = [
      {
        bugId: "bug-1",
        value: 1,
        userId: "u-1",
        name: "User One",
        image: null,
        total_count: BigInt(10),
        rn: BigInt(1),
      },
    ];

    const map = buildVoterSummaries(rows, ["bug-1"]);
    const summary = map.get("bug-1")!;
    expect(summary.likes.count).toBe(10);
    expect(summary.likes.voters).toHaveLength(1);
  });
});
