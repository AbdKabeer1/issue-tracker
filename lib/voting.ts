export type VoteChange = {
  nextVote: 1 | -1 | 0;
  countDelta: number;
};

/**
 * Pure helper for calculating score changes and next vote state
 * when upvoting (direction = 1) or downvoting (direction = -1).
 */
export function calculateVoteChange(
  currentVote: number | null | undefined,
  direction: 1 | -1,
): VoteChange {
  const current = currentVote === 1 ? 1 : currentVote === -1 ? -1 : 0;

  if (current === direction) {
    // Toggle off existing vote
    return {
      nextVote: 0,
      countDelta: -direction,
    };
  }

  if (current === 0) {
    // Fresh vote from neutral
    return {
      nextVote: direction,
      countDelta: direction,
    };
  }

  // Switching vote (+1 to -1 or -1 to +1)
  return {
    nextVote: direction,
    countDelta: direction * 2,
  };
}
