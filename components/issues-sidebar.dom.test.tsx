// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IssuesSidebar } from "./issues-sidebar";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => nav.params,
}));

const defaultCounts = {
  all: 10,
  mine: 3,
  assigned: 2,
  created: 5,
  saved: 1,
  categories: { Features: 3, Fixes: 2, Design: 1 },
  platforms: { Web: 5, Mobile: 3, Desktop: 2, "API/Backend": 1 },
};

function renderSidebar(searchParams: string) {
  nav.params = new URLSearchParams(searchParams);
  return render(
    <IssuesSidebar
      counts={defaultCounts}
      tagTypes={[]}
      platforms={[]}
    />
  );
}

function anchorFor(text: string) {
  return screen.getByText(text).closest("a")!;
}

describe("IssuesSidebar preserves active filters (#689)", () => {
  afterEach(() => {
    cleanup();
  });

  it("category link preserves q, status, severity, sort and resets page", () => {
    renderSidebar("q=auth&status=open&severity=high&sort=newest&page=3");
    const anchor = anchorFor("Features");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&severity=high&sort=newest&tags=Features",
    );
  });

  it("platform link preserves q, status, severity, sort and resets page", () => {
    renderSidebar("q=auth&status=open&severity=high&sort=newest&page=3");
    const anchor = anchorFor("Web");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&severity=high&sort=newest&platform=Web",
    );
  });

  it("'All categories' clears only tags, preserves everything else", () => {
    renderSidebar("q=auth&status=open&tags=design&platform=web&page=2");
    const anchor = anchorFor("All categories");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&platform=web",
    );
  });

  it("'All platforms' clears only platform, preserves everything else", () => {
    renderSidebar("q=auth&status=open&tags=design&platform=web&page=2");
    const anchor = anchorFor("All platforms");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open&tags=design",
    );
  });

  it("clicking category when platform is set preserves platform", () => {
    renderSidebar("q=bug&platform=web");
    const anchor = anchorFor("Fixes");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=bug&platform=web&tags=Fixes",
    );
  });

  it("clicking platform when tag is set preserves tag", () => {
    renderSidebar("q=bug&tags=design");
    const anchor = anchorFor("Mobile");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=bug&tags=design&platform=Mobile",
    );
  });

  it("empty params produce bare /issues for 'All categories'", () => {
    renderSidebar("");
    const anchor = anchorFor("All categories");
    expect(anchor).toHaveAttribute("href", "/issues");
  });

  it("empty params produce bare /issues for 'All platforms'", () => {
    renderSidebar("");
    const anchor = anchorFor("All platforms");
    expect(anchor).toHaveAttribute("href", "/issues");
  });

  it("'All issues' view clears only mine, preserves everything else", () => {
    renderSidebar("q=auth&status=open&mine=mine&page=2");
    const anchor = anchorFor("All issues");
    expect(anchor).toHaveAttribute(
      "href",
      "/issues?q=auth&status=open",
    );
  });

  it("shows aria-current on active category after navigation", () => {
    renderSidebar("q=auth&tags=Features");
    const anchor = anchorFor("Features");
    expect(anchor).toHaveAttribute("aria-current", "page");
  });

  it("shows aria-current on active platform after navigation", () => {
    renderSidebar("q=auth&platform=Web");
    const anchor = anchorFor("Web");
    expect(anchor).toHaveAttribute("aria-current", "page");
  });
});
