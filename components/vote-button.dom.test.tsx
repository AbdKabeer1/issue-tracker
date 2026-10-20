// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/issues", () => ({
  toggleVoteAction: vi.fn(),
}));

import { toggleVoteAction } from "@/app/actions/issues";
import { VoteButton } from "./vote-button";

const mockToggle = vi.mocked(toggleVoteAction);

describe("VoteButton interactive optimistic updates (#219)", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("optimistically updates like count on click and settles on server success", async () => {
    mockToggle.mockResolvedValueOnce({
      voteCount: 6,
      likeCount: 6,
      dislikeCount: 0,
      userVote: 1,
    });

    const user = userEvent.setup();
    render(
      <VoteButton
        bugId="bug-1"
        voteCount={5}
        likeCount={5}
        dislikeCount={0}
        userVote={0}
      />
    );

    const upvoteButton = screen.getByRole("button", { name: /^like this issue/i });
    expect(upvoteButton).toHaveTextContent("5");

    await user.click(upvoteButton);

    // Optimistically updated
    expect(upvoteButton).toHaveTextContent("6");
    expect(mockToggle).toHaveBeenCalledWith("bug-1", 1);

    await waitFor(() => {
      expect(upvoteButton).toHaveTextContent("6");
    });
  });

  it("rolls back optimistic like count when server action returns an error", async () => {
    mockToggle.mockResolvedValueOnce({
      error: "You cannot vote on your own issue.",
    });

    const user = userEvent.setup();
    render(
      <VoteButton
        bugId="bug-1"
        voteCount={5}
        likeCount={5}
        dislikeCount={0}
        userVote={0}
      />
    );

    const upvoteButton = screen.getByRole("button", { name: /^like this issue/i });
    expect(upvoteButton).toHaveTextContent("5");

    await user.click(upvoteButton);

    // Should rollback after error
    await waitFor(() => {
      expect(upvoteButton).toHaveTextContent("5");
      expect(screen.getByText("You cannot vote on your own issue.")).toBeInTheDocument();
    });
  });

  it("displays upvote readiness gate progress and unlocks at 3 upvotes (#764)", async () => {
    mockToggle.mockResolvedValueOnce({
      voteCount: 3,
      likeCount: 3,
      dislikeCount: 0,
      userVote: 1,
    });

    const user = userEvent.setup();
    render(
      <VoteButton
        bugId="bug-1"
        voteCount={2}
        likeCount={2}
        dislikeCount={0}
        userVote={0}
        size="md"
      />
    );

    const indicator = screen.getByTestId("readiness-gate-indicator");
    expect(indicator).toHaveTextContent("Upvote (2/3 votes to unlock work)");

    const likeButton = screen.getByRole("button", { name: /^like, 2 likes/i });
    await user.click(likeButton);

    // Optimistically updates to 3 votes and unlocks work
    expect(indicator).toHaveTextContent("Work unlocked (3/3 votes)");
  });
});
