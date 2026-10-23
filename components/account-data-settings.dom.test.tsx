// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountAction } from "@/app/actions/account";
import { AccountDataSettings } from "./account-data-settings";

vi.mock("@/app/actions/account", () => ({
  deleteAccountAction: vi.fn(),
}));

const mockedDeleteAccount = vi.mocked(deleteAccountAction);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AccountDataSettings (#571)", () => {
  beforeEach(() => {
    mockedDeleteAccount.mockReset();
    mockedDeleteAccount.mockResolvedValue({ ok: true });
  });

  it("renders download link and delete account button", () => {
    render(<AccountDataSettings />);

    const downloadLink = screen.getByRole("link", { name: /Download my data/i });
    expect(downloadLink).toBeDefined();
    expect(downloadLink.getAttribute("href")).toBe("/api/user/export");
    expect(downloadLink.hasAttribute("download")).toBe(true);

    const deleteButton = screen.getByRole("button", { name: /Delete account/i });
    expect(deleteButton).toBeDefined();
  });

  it("requires typing DELETE before permanently deleting", async () => {
    render(<AccountDataSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Delete account/i }));

    const confirmInput = screen.getByLabelText(/Type DELETE to confirm/i);
    const permanent = screen.getByRole("button", { name: /Permanently delete/i });
    expect(permanent).toHaveProperty("disabled", true);

    fireEvent.click(permanent);
    expect(mockedDeleteAccount).not.toHaveBeenCalled();

    fireEvent.change(confirmInput, { target: { value: "DELETE" } });
    expect(permanent).toHaveProperty("disabled", false);

    fireEvent.click(permanent);
    await waitFor(() => expect(mockedDeleteAccount).toHaveBeenCalled());
  });

  it("cancels the delete confirmation without calling the action", async () => {
    render(<AccountDataSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Delete account/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(screen.getByRole("button", { name: /Delete account/i })).toBeDefined();
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });

  it("displays error message if deleteAccountAction returns an error", async () => {
    mockedDeleteAccount.mockResolvedValueOnce({
      ok: false,
      error: "Cannot delete account while you are the sole owner of a workspace.",
    });

    render(<AccountDataSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Delete account/i }));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Permanently delete/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain(
        "Cannot delete account while you are the sole owner of a workspace.",
      );
    });
  });
});
