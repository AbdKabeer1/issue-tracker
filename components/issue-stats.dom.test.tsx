// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { vi } from "vitest";
import { IssueStats } from "./issue-stats";

// The tile links are plain anchors in this harness; the component only needs
// useSearchParams to build hrefs.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function renderStats() {
  return render(
    <IssueStats total={128} open={64} inProgress={21} closed={43} />
  );
}

describe("IssueStats tiles (#685)", () => {
  beforeEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/issues");
  });

  it("renders every stat as a link, so nothing looks interactive but is dead", () => {
    renderStats();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute("href");
    }
  });

  it("points Total at the unfiltered list and the status tiles at their filters", () => {
    renderStats();
    expect(screen.getByRole("link", { name: /total issues/i })).toHaveAttribute(
      "href",
      "/issues"
    );
    expect(screen.getByRole("link", { name: /^64\s*open$/i })).toHaveAttribute(
      "href",
      "/issues?status=open"
    );
    expect(
      screen.getByRole("link", { name: /in progress/i })
    ).toHaveAttribute("href", "/issues?status=in_progress");
  });

  it("links Closed to the same resolved + closed aggregate it counts", () => {
    renderStats();
    const closed = screen.getByRole("link", { name: /closed/i });
    // Count and destination describe the same set: resolved + closed.
    expect(closed).toHaveAttribute("href", "/issues?status=finished");
    expect(closed).toHaveAttribute("title", "Resolved and closed issues");
  });

  it("drops the meaningless decorative progress bars", () => {
    const { container } = renderStats();
    // The old tiles drew an h-1 bar repeating the count with no scale labels.
    expect(container.querySelector(".h-1")).toBeNull();
  });

  it("marks the active status tile with aria-current", () => {
    window.history.replaceState(null, "", "/issues?status=finished");
    renderStats();
    expect(screen.getByRole("link", { name: /closed/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
