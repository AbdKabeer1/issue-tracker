// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => params.current,
}));

import { IssuesSidebar } from "./issues-sidebar";

const counts = {
  all: 10,
  mine: 1,
  assigned: 2,
  created: 3,
  saved: 0,
  categories: { Feat: 6, Design: 4, Features: 3, Fixes: 2 },
  platforms: { web: 7, Web: 7, desk: 3, Desktop: 3, Mobile: 3, "API/Backend": 1 },
};

function sidebar(props: Partial<Parameters<typeof IssuesSidebar>[0]> = {}) {
  return render(
    <IssuesSidebar
      counts={counts}
      tagTypes={[
        { id: "t1", name: "Feat", isActive: true },
        { id: "t2", name: "Design", isActive: true },
        { id: "t3", name: "Old", isActive: false },
        { id: "t4", name: "Features", isActive: true },
        { id: "t5", name: "Fixes", isActive: true },
      ]}
      platforms={[
        { id: "web", name: "Web", isActive: true },
        { id: "desk", name: "Desktop", isActive: true },
        { id: "mob", name: "Mobile", isActive: true },
        { id: "gone", name: "Legacy", isActive: false },
      ]}
      {...props}
    />,
  );
}

function anchorFor(text: string) {
  return screen.getByText(text).closest("a")!;
}

afterEach(() => {
  cleanup();
  params.current = new URLSearchParams();
});

describe("issues sidebar (#541)", () => {
  it("lists the tenant's own types and platforms, with their counts", () => {
    sidebar();
    const nav = screen.getByRole("navigation", { name: "Issues Navigation" });
    const feat = within(nav).getByRole("link", { name: /^Feat\b/ });
    expect(feat).toHaveTextContent("6");
    expect(within(nav).getByRole("link", { name: /^Web/ })).toHaveTextContent("7");
    expect(within(nav).getByRole("link", { name: /^Desktop/ })).toHaveAttribute("href", "/issues?platform=desk");
  });

  it("doesn't invent categories or platforms the tenant doesn't have", () => {
    sidebar();
    for (const name of ["Marketing", "Documentation", "Other", "API/Backend"]) {
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

describe("IssuesSidebar preserves active filters (#689)", () => {
  it("category link preserves q, status, severity, sort and resets page", () => {
    params.current = new URLSearchParams("q=auth&status=open&severity=high&sort=newest&page=3");
    sidebar();
    const anchor = anchorFor("Features");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&severity=high&sort=newest&tags=Features",
    );
  });

  it("platform link preserves q, status, severity, sort and resets page", () => {
    params.current = new URLSearchParams("q=auth&status=open&severity=high&sort=newest&page=3");
    sidebar();
    const anchor = anchorFor("Web");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&severity=high&sort=newest&platform=web",
    );
  });

  it("'All categories' clears only tags, preserves everything else", () => {
    params.current = new URLSearchParams("q=auth&status=open&tags=design&platform=web&page=2");
    sidebar();
    const anchor = anchorFor("All categories");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&platform=web",
    );
  });

  it("'All platforms' clears only platform, preserves everything else", () => {
    params.current = new URLSearchParams("q=auth&status=open&tags=design&platform=web&page=2");
    sidebar();
    const anchor = anchorFor("All platforms");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&tags=design",
    );
  });

  it("clicking category when platform is set preserves platform", () => {
    params.current = new URLSearchParams("q=bug&platform=web");
    sidebar();
    const anchor = anchorFor("Fixes");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=bug&platform=web&tags=Fixes",
    );
  });

  it("clicking platform when tag is set preserves tag", () => {
    params.current = new URLSearchParams("q=bug&tags=design");
    sidebar();
    const anchor = anchorFor("Mobile");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=bug&tags=design&platform=mob",
    );
  });

  it("empty params produce bare /issues for 'All categories'", () => {
    params.current = new URLSearchParams("");
    sidebar();
    const anchor = anchorFor("All categories");
    expect(anchor).toHaveAttribute("href", "/issues");
  });

  it("empty params produce bare /issues for 'All platforms'", () => {
    params.current = new URLSearchParams("");
    sidebar();
    const anchor = anchorFor("All platforms");
    expect(anchor).toHaveAttribute("href", "/issues");
  });

  it("'All issues' view clears only mine, preserves everything else", () => {
    params.current = new URLSearchParams("q=auth&status=open&mine=mine&page=2");
    sidebar();
    const anchor = anchorFor("All issues");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open",
    );
  });

  it("shows aria-current on active category after navigation", () => {
    params.current = new URLSearchParams("q=auth&tags=Features");
    sidebar();
    const anchor = anchorFor("Features");
    expect(anchor).toHaveAttribute("aria-current", "page");
  });

  it("shows aria-current on active platform after navigation", () => {
    params.current = new URLSearchParams("q=auth&platform=web");
    sidebar();
    const anchor = anchorFor("Web");
    expect(anchor).toHaveAttribute("aria-current", "page");
  });
});
