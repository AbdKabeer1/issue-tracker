// @vitest-environment jsdom
"use client";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createBugAction } from "@/app/actions/issues";
import { CreateBugForm } from "./create-issue-form";

vi.mock("@/app/actions/issues", () => ({
  createBugAction: vi.fn(),
}));

const mockedCreateBug = vi.mocked(createBugAction);

// Set by tests that defer the mocked action's resolution; always released in
// afterEach so a failed assertion cannot leak a pending transition.
let releasePendingAction: (() => void) | null = null;

afterEach(() => {
  releasePendingAction?.();
  releasePendingAction = null;
  cleanup();
});

const defaultProps = {
  users: [{ id: "u1", name: "Alice", role: "user" as const }],
  categories: [
    { id: "c1", name: "macOS" },
    { id: "c2", name: "Windows" },
  ],
  types: [{ id: "t1", name: "Bug" }, { id: "t2", name: "Feature" }],
  isAdmin: false,
} as Parameters<typeof CreateBugForm>[0];

let capturedFormData: FormData | null = null;

function renderForm(props: Parameters<typeof CreateBugForm>[0] = defaultProps) {
  return render(<CreateBugForm {...props} />);
}

function titleInput() {
  return screen.getByLabelText("Title") as HTMLInputElement;
}

function descriptionTextarea() {
  // The MarkdownEditor gives the mention combobox wrapper the same accessible
  // name as the textarea ("Description"), so getByLabelText matches twice.
  // Query by role to pin the actual text field (#326).
  return screen.getByRole("textbox", {
    name: "Description",
  }) as HTMLTextAreaElement;
}

function submitButton() {
  return screen.getByRole("button", {
    name: /^(Create issue|Creating…|Uploading…)$/,
  }) as HTMLButtonElement;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(titleInput(), "App crashes on launch");
  await user.type(
    descriptionTextarea(),
    "Steps to reproduce: it crashes every time.",
  );
}

describe("CreateBugForm optimistic submission", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    capturedFormData = null;
    mockedCreateBug.mockReset();
    mockedCreateBug.mockResolvedValue({ ok: true });
    user = userEvent.setup();
  });

  it("submits the form and enables the button once the action resolves", async () => {
    // Hold the action open until the test releases it so the pending state
    // ("Creating…"/disabled) is observable instead of racing the assertion.
    mockedCreateBug.mockImplementationOnce((formData) => {
      capturedFormData = formData;
      return new Promise((resolve) => {
        releasePendingAction = () => resolve({ ok: true });
      });
    });

    renderForm();
    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => {
      expect(mockedCreateBug).toHaveBeenCalledTimes(1);
      expect(submitButton().disabled).toBe(true);
      expect(submitButton().textContent).toBe("Creating…");
    });

    releasePendingAction?.();
    releasePendingAction = null;

    await waitFor(() => expect(submitButton().disabled).toBe(false));

    expect(capturedFormData?.get("title")).toBe("App crashes on launch");
    expect(capturedFormData?.get("description")).toBe(
      "Steps to reproduce: it crashes every time.",
    );
    // Default type is the first option ("Bug").
    expect(capturedFormData?.get("typeId")).toBe("t1");
    expect(capturedFormData?.get("categoryId")).toBe("");
    expect(capturedFormData?.get("proofLinks")).toBe("");

    expect(submitButton().textContent).toBe("Create issue");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the server error and preserves the form values on failure", async () => {
    mockedCreateBug.mockResolvedValueOnce({
      error: "Something went wrong. Please try again.",
    });

    renderForm();
    await fillValidForm(user);

    await user.click(submitButton());

    // Error surfaced and the button settled back to its idle state.
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Something went wrong. Please try again.",
      );
      expect(submitButton().disabled).toBe(false);
      expect(submitButton().textContent).toBe("Create issue");
    });

    expect(titleInput().value).toBe("App crashes on launch");
  });

  it("sends severity and assignee when rendered as admin", async () => {
    mockedCreateBug.mockImplementationOnce((formData) => {
      capturedFormData = formData;
      return Promise.resolve({ ok: true });
    });

    renderForm({ ...defaultProps, isAdmin: true });

    await fillValidForm(user);
    await user.selectOptions(screen.getByLabelText("Severity"), "critical");

    // Assignee is a searchable combobox (#174), not a <select>: open it, then
    // click the matching person in the listbox.
    await user.click(screen.getByLabelText("Assignee"));
    await user.click(
      await screen.findByRole("option", { name: "Alice" }),
    );

    await user.click(submitButton());
    await waitFor(() => expect(mockedCreateBug).toHaveBeenCalledTimes(1));

    expect(capturedFormData?.get("severity")).toBe("critical");
    expect(capturedFormData?.get("assigneeId")).toBe("u1");
  });

  it("assigns the bug to the current user when the checkbox is checked", async () => {
    mockedCreateBug.mockImplementationOnce((formData) => {
      capturedFormData = formData;
      return Promise.resolve({ ok: true });
    });

    renderForm({ ...defaultProps, currentUserId: "u1" });

    await fillValidForm(user);
    await user.click(screen.getByLabelText("Assign this issue to myself"));

    await user.click(submitButton());
    await waitFor(() => expect(mockedCreateBug).toHaveBeenCalledTimes(1));

    expect(capturedFormData?.get("assigneeId")).toBe("u1");
  });

  it("does not assign anyone when the checkbox is left unchecked", async () => {
    mockedCreateBug.mockImplementationOnce((formData) => {
      capturedFormData = formData;
      return Promise.resolve({ ok: true });
    });

    renderForm({ ...defaultProps, currentUserId: "u1" });

    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(mockedCreateBug).toHaveBeenCalledTimes(1));

    expect(capturedFormData?.get("assigneeId")).toBeNull();
  });

  it("disables submit button and prevents submission while an attachment is uploading (#734)", async () => {
    let resolveUpload: (val: unknown) => void = () => {};
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = () =>
            resolve({
              ok: true,
              json: async () => ({ id: "att-456", size: 4096 }),
            });
        }),
    );

    mockedCreateBug.mockImplementationOnce((formData) => {
      capturedFormData = formData;
      return Promise.resolve({ ok: true });
    });

    try {
      const { container } = renderForm();
      await fillValidForm(user);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const file = new File(["content"], "diag.png", { type: "image/png" });
      await user.upload(fileInput, file);

      // Submit button should be disabled and show Uploading…
      await waitFor(() => {
        expect(submitButton().disabled).toBe(true);
        expect(submitButton().textContent).toBe("Uploading…");
      });

      // Attempting to submit form while uploading should be prevented
      const form = container.querySelector("form") as HTMLFormElement;
      form.requestSubmit();
      expect(mockedCreateBug).not.toHaveBeenCalled();

      // Resolve upload
      resolveUpload(null);

      // Button becomes enabled
      await waitFor(() => {
        expect(submitButton().disabled).toBe(false);
        expect(submitButton().textContent).toBe("Create issue");
      });

      // Submit should now succeed with attachment included
      await user.click(submitButton());
      await waitFor(() => expect(mockedCreateBug).toHaveBeenCalledTimes(1));

      expect(capturedFormData?.get("attachmentIds")).toBe("att-456");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

