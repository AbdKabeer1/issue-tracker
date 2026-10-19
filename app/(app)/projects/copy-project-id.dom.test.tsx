// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyProjectIdButton } from "./copy-project-id";
import * as clipboard from "@/lib/clipboard";

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  mockToast.mockReset();
});

describe("CopyProjectIdButton (#629)", () => {
  it("renders with accessible button name", () => {
    render(<CopyProjectIdButton projectId="proj-123" />);
    expect(screen.getByRole("button", { name: "Copy Project ID" })).toBeDefined();
    expect(screen.getByText("Copy ID")).toBeDefined();
  });

  it("copies project ID and shows confirmation on click", async () => {
    vi.spyOn(clipboard, "copyText").mockResolvedValue(true);

    render(<CopyProjectIdButton projectId="proj-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Project ID" }));

    await waitFor(() => {
      expect(clipboard.copyText).toHaveBeenCalledWith("proj-123");
      expect(mockToast).toHaveBeenCalledWith("Project ID copied to clipboard.");
      expect(screen.getByText("Copied")).toBeDefined();
    });
  });

  it("handles copy failure gracefully", async () => {
    vi.spyOn(clipboard, "copyText").mockResolvedValue(false);

    render(<CopyProjectIdButton projectId="proj-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Project ID" }));

    await waitFor(() => {
      expect(clipboard.copyText).toHaveBeenCalledWith("proj-123");
      expect(mockToast).toHaveBeenCalledWith(
        "Couldn't copy automatically. Project ID: proj-123",
        "error",
      );
    });
  });
});
