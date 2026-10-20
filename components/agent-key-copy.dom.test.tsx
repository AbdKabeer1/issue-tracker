// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentKeyCopyButton } from "./agent-key-copy";
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

describe("AgentKeyCopyButton", () => {
  it("renders null when projectId is missing", () => {
    const { container } = render(<AgentKeyCopyButton projectId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders key label and copy button on top left", () => {
    render(<AgentKeyCopyButton projectId="cly-test-project-123" projectName="Zedu Core" />);
    expect(screen.getByText("Agent Key:")).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy key to agent" })).toBeDefined();
  });

  it("copies project key to clipboard when copy button is clicked", async () => {
    vi.spyOn(clipboard, "copyText").mockResolvedValue(true);

    render(<AgentKeyCopyButton projectId="cly-test-project-123" projectName="Zedu Core" />);
    const copyButton = screen.getByRole("button", { name: "Copy key to agent" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboard.copyText).toHaveBeenCalledWith("cly-test-project-123");
      expect(mockToast).toHaveBeenCalledWith("Agent project key copied to clipboard.");
      expect(screen.getByText("Copied")).toBeDefined();
    });
  });

  it("opens details popover on clicking key label and displays project key info", () => {
    render(<AgentKeyCopyButton projectId="cly-test-project-123" projectName="Zedu Core" />);
    const detailsButton = screen.getByRole("button", { name: "Agent Key details" });
    fireEvent.click(detailsButton);

    expect(screen.getByRole("dialog", { name: "Agent Key Information" })).toBeDefined();
    expect(screen.getByText("Zedu Core")).toBeDefined();
    expect(screen.getByText("cly-test-project-123")).toBeDefined();
  });

  it("handles copy failure gracefully", async () => {
    vi.spyOn(clipboard, "copyText").mockResolvedValue(false);

    render(<AgentKeyCopyButton projectId="cly-fail-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy key to agent" }));

    await waitFor(() => {
      expect(clipboard.copyText).toHaveBeenCalledWith("cly-fail-id");
      expect(mockToast).toHaveBeenCalledWith("Could not copy. Key: cly-fail-id", "error");
    });
  });
});
