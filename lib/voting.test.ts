import { describe, expect, it } from "vitest";
import { calculateVoteChange } from "./voting";

describe("calculateVoteChange", () => {
  it("upvotes from neutral (0 -> +1)", () => {
    expect(calculateVoteChange(0, 1)).toEqual({
      nextVote: 1,
      countDelta: 1,
    });
    expect(calculateVoteChange(null, 1)).toEqual({
      nextVote: 1,
      countDelta: 1,
    });
    expect(calculateVoteChange(undefined, 1)).toEqual({
      nextVote: 1,
      countDelta: 1,
    });
  });

  it("downvotes from neutral (0 -> -1)", () => {
    expect(calculateVoteChange(0, -1)).toEqual({
      nextVote: -1,
      countDelta: -1,
    });
  });

  it("toggles off upvote (+1 -> 0)", () => {
    expect(calculateVoteChange(1, 1)).toEqual({
      nextVote: 0,
      countDelta: -1,
    });
  });

  it("toggles off downvote (-1 -> 0)", () => {
    expect(calculateVoteChange(-1, -1)).toEqual({
      nextVote: 0,
      countDelta: 1,
    });
  });

  it("switches from upvote to downvote (+1 -> -1)", () => {
    expect(calculateVoteChange(1, -1)).toEqual({
      nextVote: -1,
      countDelta: -2,
    });
  });

  it("switches from downvote to upvote (-1 -> +1)", () => {
    expect(calculateVoteChange(-1, 1)).toEqual({
      nextVote: 1,
      countDelta: 2,
    });
  });
});
