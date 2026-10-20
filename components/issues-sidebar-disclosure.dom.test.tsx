// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { IssuesSidebarDisclosure } from "./issues-sidebar-disclosure";

const counts = {
  all: 3,
  mine: 0,
  assigned: 0,
  created: 0,
  saved: 0,
  categories: {},
  platforms: {},
};

afterEach(cleanup);

describe("IssuesSidebarDisclosure (#574)", () => {
  it("collapses the sidebar behind a closed disclosure on phones", () => {
    const { container } = render(<IssuesSidebarDisclosure counts={counts} />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details).toHaveClass("lg:hidden");
    expect(details?.open).toBe(false);
    expect(screen.getByText("Views & filters")).toBeInTheDocument();
  });

  it("keeps the full navigation inside the disclosure", () => {
    render(<IssuesSidebarDisclosure counts={counts} />);
    expect(screen.getByRole("navigation", { name: "Issues Navigation" })).toBeInTheDocument();
  });
});
