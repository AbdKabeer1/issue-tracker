// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IssueStats } from "./issue-stats";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

afterEach(cleanup);

function renderStats() {
  return render(
    <IssueStats total={128} open={64} inProgress={21} closed={43} />,
  );
}

describe("IssueStats tiles (#685)", () => {
  beforeEach(() => {
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
      "/issues",
    );
    expect(screen.getByRole("link", { name: /^64\s*open$/i })).toHaveAttribute(
      "href",
      "/issues?status=open",
    );
    expect(
      screen.getByRole("link", { name: /in progress/i }),
    ).toHaveAttribute("href", "/issues?status=in_progress");
  });

  it("links Closed to the same resolved + closed aggregate it counts", () => {
    renderStats();
    const closed = screen.getByRole("link", { name: /closed/i });
    expect(closed).toHaveAttribute("href", "/issues?status=finished");
    expect(closed).toHaveAttribute("title", "Resolved and closed issues");
  });

  it("drops the meaningless decorative progress bars", () => {
    const { container } = renderStats();
    expect(container.querySelector(".h-1")).toBeNull();
  });

  it("marks the active status tile with aria-current", () => {
    window.history.replaceState(null, "", "/issues?status=finished");
    renderStats();
    expect(screen.getByRole("link", { name: /closed/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

const stats = { total: 10, open: 4, inProgress: 2, closed: 4 };

describe("IssueStats mobile chrome (#574)", () => {
  it("renders one compact, horizontally scrollable line on phones", () => {
    const { container } = render(<IssueStats {...stats} />);
    const grid = container.querySelector("section > div");
    expect(grid).not.toBeNull();
    expect(grid).toHaveClass("overflow-x-auto");
    expect(grid).toHaveClass("lg:grid");
  });

  it("hides the large icons below sm so the row stays short", () => {
    const { container } = render(<IssueStats {...stats} />);
    const iconBoxes = container.querySelectorAll("a > div:first-child");
    expect(iconBoxes.length).toBe(4);
    iconBoxes.forEach((box) => {
      expect(box).toHaveClass("hidden", "sm:flex");
    });
  });
});
