// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { IssueStats } from "./issue-stats";

afterEach(cleanup);

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
