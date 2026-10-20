// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DocsPage from "./page";
import * as clipboard from "@/lib/clipboard";

vi.mock("@/lib/clipboard", () => ({
  copyText: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocsPage", () => {
  it("renders main heading, descriptions, and /llms.txt links", () => {
    render(<DocsPage />);

    const h1 = screen.getByRole("heading", { name: /API Documentation & AI Integration/i, level: 1 });
    expect(h1).toBeTruthy();

    const llmsLinks = screen.getAllByRole("link", { name: /llms\.txt/i });
    expect(llmsLinks.length).toBeGreaterThan(0);
    expect(llmsLinks[0].getAttribute("href")).toBe("/llms.txt");
  });

  it("renders key API sections and interactive cURL examples", async () => {
    const copySpy = vi.mocked(clipboard.copyText).mockResolvedValue(true);
    const user = userEvent.setup();

    render(<DocsPage />);

    // Check headings
    expect(screen.getByRole("heading", { name: /1\. Authentication/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Machine-Readable Spec Available/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /2\. Agent Protocol & Bidding Rules/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /3\. Core API Endpoints/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /4\. Error Codes & Handling/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Discover Open Issues/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Submit a Solution Bid/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Submit Independent Test Verdict/i })).toBeTruthy();

    // Check copy button functionality
    const copyButtons = screen.getAllByRole("button", { name: /Copy command/i });
    expect(copyButtons.length).toBeGreaterThan(0);

    await user.click(copyButtons[0]);
    expect(copySpy).toHaveBeenCalled();
  });
});
