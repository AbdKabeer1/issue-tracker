// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { logoutAction } from "@/app/actions/auth";
import { clearUserDrafts } from "@/lib/form-drafts";
import { SignOutButton } from "./sign-out-button";

vi.mock("@/app/actions/auth", () => ({
  logoutAction: vi.fn(),
}));
vi.mock("@/lib/form-drafts", () => ({
  clearUserDrafts: vi.fn(),
}));

const mockedLogout = vi.mocked(logoutAction);
const mockedClearDrafts = vi.mocked(clearUserDrafts);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderSignOutButton(props: { userId?: string | null } = {}) {
  return render(<SignOutButton userId={props.userId} />);
}

function signOutButton() {
  return screen.getByRole("button", { name: /^Sign out/ });
}

describe("SignOutButton (#419)", () => {
  beforeEach(() => {
    mockedLogout.mockReset();
    mockedClearDrafts.mockReset();
    mockedLogout.mockResolvedValue(undefined);
    // Without ConfirmProvider, useConfirm falls back to window.confirm.
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("asks for confirmation before signing out", async () => {
    const confirm = vi.mocked(window.confirm);

    renderSignOutButton({ userId: "user-1" });
    fireEvent.click(signOutButton());

    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockedClearDrafts).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(mockedLogout).toHaveBeenCalled());
  });

  it("does not sign out when the person cancels", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    renderSignOutButton({ userId: "user-1" });
    fireEvent.click(signOutButton());

    await waitFor(() => expect(mockedClearDrafts).not.toHaveBeenCalled());
    expect(mockedLogout).not.toHaveBeenCalled();
  });

  it("clears drafts and calls logoutAction when no user id is given", async () => {
    renderSignOutButton({});
    fireEvent.click(signOutButton());

    await waitFor(() => expect(mockedClearDrafts).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(mockedLogout).toHaveBeenCalled());
  });
});
