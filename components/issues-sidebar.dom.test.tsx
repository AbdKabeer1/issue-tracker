// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params.current }));

import { IssuesSidebar } from "./issues-sidebar";

const counts = {
  all: 10,
  mine: 1,
  assigned: 2,
  created: 3,
  saved: 0,
  categories: { Feat: 6, Design: 4 },
  platforms: { web: 7, Web: 7, desk: 3, Desktop: 3 },
};

function sidebar(props: Partial<Parameters<typeof IssuesSidebar>[0]> = {}) {
  return render(
    <IssuesSidebar
      counts={counts}
      tagTypes={[
        { id: "t1", name: "Feat", isActive: true },
        { id: "t2", name: "Design", isActive: true },
        { id: "t3", name: "Old", isActive: false },
      ]}
      platforms={[
        { id: "web", name: "Web", isActive: true },
        { id: "desk", name: "Desktop", isActive: true },
        { id: "gone", name: "Legacy", isActive: false },
      ]}
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  params.current = new URLSearchParams();
});

describe("issues sidebar (#541)", () => {
  it("lists the tenant's own types and platforms, with their counts", () => {
    sidebar();
    const nav = screen.getByRole("navigation", { name: "Issues Navigation" });
    const feat = within(nav).getByRole("link", { name: /Feat/ });
    expect(feat).toHaveTextContent("6");
    expect(within(nav).getByRole("link", { name: /^Web/ })).toHaveTextContent("7");
    expect(within(nav).getByRole("link", { name: /^Desktop/ })).toHaveAttribute("href", "/issues?platform=desk");
  });

  it("doesn't invent categories or platforms the tenant doesn't have", () => {
    sidebar();
    for (const name of ["Features", "Fixes", "Marketing", "Documentation", "Other", "Mobile", "API/Backend"]) {
      expect(screen.queryByRole("link", { name: new RegExp(`^${name.replace("/", "\\/")}`) })).toBeNull();
    }
  });

  it("hides inactive ones unless they're the current filter", () => {
    sidebar();
    expect(screen.queryByRole("link", { name: /^Old/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Legacy/ })).toBeNull();
    cleanup();
    params.current = new URLSearchParams("tags=Old&platform=gone");
    sidebar();
    expect(screen.getByRole("link", { name: /^Old/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Legacy/ })).toBeInTheDocument();
  });

  it("leaves out an empty section instead of showing only an 'All' row", () => {
    sidebar({ tagTypes: [], platforms: [] });
    expect(screen.queryByText("Categories")).toBeNull();
    expect(screen.queryByText("Platforms")).toBeNull();
    expect(screen.getByRole("link", { name: /All issues/ })).toBeInTheDocument();
  });
});
