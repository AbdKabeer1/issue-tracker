"use client";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { addCommentAction } from "@/app/actions/bugs";
import { CommentForm } from "./comment-form";

vi.mock("@/app/actions/bugs", () => ({
  addCommentAction: vi.fn(),
}));

const mockedAddComment = vi.mocked(addCommentAction);

// Set by tests that defer the mocked action's resolution; always released in
// afterEach so a failed assertion cannot leak a pending transition.
let releasePendingAction: (() => void) | null = null;

afterEach(() => {
  releasePendingAction?.();
  releasePendingAction = null;
  cleanup();
});

const defaultProps = {
  bugId: "b1",
  users: [] as { id: string; name: string }[],
};

function renderForm(props: Parameters<typeof CommentForm>[0] = defaultProps) {
  return render(<CommentForm {...props} />);
}

function bodyTextarea() {
  return screen.getByLabelText("Add a comment") as HTMLTextAreaElement;
}

function submitButton() {
  return screen.getByRole("button", {
    name: /^(Post comment|Posting…)$/,
  }) as HTMLButtonElement;
}

describe("CommentForm optimistic update and rollback", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockedAddComment.mockReset();
    mockedAddComment.mockResolvedValue({ ok: true });
    user = userEvent.setup();
  });

  it("posts a comment, clears the form, and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    // Hold the action open until the test releases it so the pending state
    // ("Posting…"/disabled) is observable instead of racing the assertion.
    mockedAddComment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePendingAction = () => resolve({ ok: true });
        }),
    );
    renderForm({ ...defaultProps, onSuccess });

    const textarea = bodyTextarea();
    await user.type(textarea, "Looks good to me");
    expect(textarea.value).toBe("Looks good to me");
    // "Looks good to me" is 16 characters.
    expect(screen.getByText("16/2000")).toBeTruthy();

    await user.click(submitButton());
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledTimes(1);
      expect(submitButton().disabled).toBe(true);
      expect(submitButton().textContent).toBe("Posting…");
    });

    releasePendingAction?.();
    releasePendingAction = null;

    // Everything settles once the transition completes.
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(textarea.value).toBe("");
      expect(submitButton().textContent).toBe("Post comment");
      expect(screen.queryByRole("alert")).toBeNull();
      // Body was cleared, so the button stays disabled for the empty form.
      expect(submitButton().disabled).toBe(true);
    });

    expect(mockedAddComment).toHaveBeenCalledWith("b1", expect.any(FormData));
    const formData = mockedAddComment.mock.calls[0]?.[1] as FormData;
    expect(formData.get("body")).toBe("Looks good to me");
  });

  it("keeps the body and shows the error when the action fails", async () => {
    mockedAddComment.mockResolvedValueOnce({ error: "Rate limited, try again" });

    renderForm();

    const textarea = bodyTextarea();
    await user.type(textarea, "Hey");

    await user.click(submitButton());

    // Rolled back once the transition settles: error shown, body kept,
    // button back to its idle state.
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Rate limited, try again",
      );
      expect(textarea.value).toBe("Hey");
      expect(submitButton().disabled).toBe(false);
      expect(submitButton().textContent).toBe("Post comment");
    });
  });

  it("disables the submit button when the body is empty", () => {
    renderForm();
    expect(submitButton().disabled).toBe(true);
  });

  it("renders the reply variant and supports cancelling", async () => {
    const onCancel = vi.fn();
    renderForm({
      ...defaultProps,
      parentId: "c1",
      parentAuthorName: "Alice",
      onCancel,
    });

    expect(screen.getByLabelText("Reply to Alice")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post reply" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
