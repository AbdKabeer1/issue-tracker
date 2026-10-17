"use client";

import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { toggleVoteAction } from "@/app/actions/bugs";
import { VoteButton } from "./vote-button";

vi.mock("@/app/actions/bugs", () => ({
  toggleVoteAction: vi.fn(),
}));

const mockedToggleVote = vi.mocked(toggleVoteAction);

afterEach(() => cleanup());

const serverResult = {
  ok: true,
  voteCount: 3,
  likeCount: 3,
  dislikeCount: 0,
  userVote: 1,
  voted: true,
};

function renderVoteButton(
  props: Partial<Parameters<typeof VoteButton>[0]> = {},
) {
  return render(<VoteButton bugId="b1" voteCount={2} {...props} />);
}

function likeButton() {
  return screen.getByRole("button", {
    name: /^(Like|Unlike) this issue$/,
  }) as HTMLButtonElement;
}

function dislikeButton() {
  return screen.getByRole("button", {
    name: /^(Dislike|Remove dislike)$/,
  }) as HTMLButtonElement;
}

function countOf(button: HTMLElement) {
  return within(button).getByText(/\d+/);
}

describe("VoteButton optimistic update and rollback", () => {
  beforeEach(() => {
    mockedToggleVote.mockReset();
    mockedToggleVote.mockResolvedValue(serverResult);
  });

  it("applies the vote optimistically, disables while pending, then reconciles with the server", async () => {
    mockedToggleVote.mockImplementationOnce(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve(serverResult), 20);
      }),
    );

    renderVoteButton();
    const like = likeButton();

    expect(countOf(like).textContent).toBe("2");
    expect(like.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(like);

    // Optimistic update is immediate: count goes up, button is pressed.
    expect(countOf(like).textContent).toBe("3");
    expect(like.getAttribute("aria-pressed")).toBe("true");
    // The transition keeps the button disabled while the action is in flight.
    expect(like.disabled).toBe(true);

    await waitFor(() => expect(mockedToggleVote).toHaveBeenCalledWith("b1", 1));

    // Server values replace the optimistic ones once the action resolves
    // and the transition settles.
    await waitFor(() => {
      expect(like.disabled).toBe(false);
      expect(countOf(like).textContent).toBe("3");
      expect(mockedToggleVote).toHaveBeenCalledTimes(1);
    });
  });

  it("rolls back the optimistic update when the action returns an error", async () => {
    mockedToggleVote.mockResolvedValueOnce({ error: "Vote failed" });

    renderVoteButton();
    const like = likeButton();

    fireEvent.click(like);

    expect(countOf(like).textContent).toBe("3");
    expect(like.getAttribute("aria-pressed")).toBe("true");

    // Rolled back to the pre-click state once the transition settles.
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Vote failed");
      expect(countOf(like).textContent).toBe("2");
      expect(like.getAttribute("aria-pressed")).toBe("false");
      expect(like.disabled).toBe(false);
    });
  });

  it("toggles off an existing like", async () => {
    mockedToggleVote.mockResolvedValueOnce({
      ok: true,
      voteCount: 1,
      likeCount: 1,
      dislikeCount: 0,
      userVote: 0,
      voted: false,
    });

    // userVote=1 with voteCount=2 seeds likeCount=2.
    renderVoteButton({ userVote: 1 });
    const like = likeButton();

    expect(like.getAttribute("aria-pressed")).toBe("true");
    expect(countOf(like).textContent).toBe("2");

    fireEvent.click(like);

    await waitFor(() => expect(mockedToggleVote).toHaveBeenCalledWith("b1", 1));

    // Button is now "Unlike this issue" → toggled off → "Like this issue"
    expect(like.getAttribute("aria-pressed")).toBe("false");
    expect(countOf(like).textContent).toBe("1");
  });

  it("switches a dislike into a like", async () => {
    mockedToggleVote.mockResolvedValueOnce({
      ok: true,
      voteCount: 5,
      likeCount: 2,
      dislikeCount: 0,
      userVote: 1,
      voted: true,
    });

    renderVoteButton({ userVote: -1, likeCount: 1, dislikeCount: 1 });
    const like = likeButton();
    const dislike = dislikeButton();

    expect(dislike.getAttribute("aria-pressed")).toBe("true");
    expect(countOf(dislike).textContent).toBe("1");
    expect(countOf(like).textContent).toBe("1");

    fireEvent.click(like);

    await waitFor(() => expect(countOf(dislike).textContent).toBe("0"));
    expect(countOf(like).textContent).toBe("2");
    expect(like.getAttribute("aria-pressed")).toBe("true");
    expect(dislike.getAttribute("aria-pressed")).toBe("false");
  });
});
