// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => nav.params,
}));

const fetchMock = vi.fn();

import { IssueFilters } from "./issue-filters";

const tagTypes = [
  { id: "t1", name: "Design" },
  { id: "t2", name: "Fixes" },
];

describe("IssueFilters milestone filters (#728)", () => {
  const milestones = [
    { id: "m1", title: "Release 1", isClosed: false },
    { id: "m2", title: "Release 2", isClosed: true },
  ];

  beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.push.mockReset();
    nav.replace.mockReset();
  });
  afterEach(cleanup);

  it.each([["m1", "Release 1"], ["m2", "Release 2"], ["none", "No milestone"]])(
    "shows a removable milestone-only filter for %s",
    (id, label) => {
      nav.params = new URLSearchParams(`milestone=${id}&page=3`);
      render(<IssueFilters milestones={milestones} />);

      const remove = screen.getByRole("button", { name: "Remove milestone filter" });
      expect(remove.parentElement).toHaveTextContent(`Milestone: ${label}`);
      expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
      fireEvent.click(remove);
      expect(nav.push).toHaveBeenCalledWith("/issues");
    },
  );

  it("preserves other filters and resets paging when removing a milestone", () => {
    nav.params = new URLSearchParams("milestone=m1&status=open&page=3");
    render(<IssueFilters milestones={milestones} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone filter" }));
    expect(nav.push).toHaveBeenCalledWith("/issues?status=open");
  });

  it("clears the milestone along with other filters", () => {
    nav.params = new URLSearchParams("milestone=m1&status=open&page=3");
    render(<IssueFilters milestones={milestones} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(nav.push).toHaveBeenCalledWith("/issues");
  });

  it("does not show active controls for an empty milestone", () => {
    nav.params = new URLSearchParams("milestone=&page=3");
    render(<IssueFilters milestones={milestones} />);
    expect(screen.queryByRole("button", { name: "Remove milestone filter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });
});

function typeSearch(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Search" }), {
    target: { value },
  });
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("IssueFilters live search (#671)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.params = new URLSearchParams();
    nav.push.mockReset();
    nav.replace.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("filters the list a moment after typing stops", async () => {
    render(<IssueFilters tagTypes={tagTypes} />);

    typeSearch("login");
    expect(nav.push).not.toHaveBeenCalled();

    await settle();
    expect(nav.push).toHaveBeenCalledWith("/issues?q=login");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("keeps one history entry per typing session", async () => {
    render(<IssueFilters tagTypes={tagTypes} />);

    typeSearch("log");
    await settle();
    expect(nav.push).toHaveBeenCalledWith("/issues?q=log");

    typeSearch("login");
    await settle();
    expect(nav.replace).toHaveBeenCalledWith("/issues?q=login");
    expect(nav.push).toHaveBeenCalledTimes(1);
  });

  it("suggests matching issue titles and opens the picked one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [{ id: "i1", number: 4, title: "Login button broken", status: "open" }],
      }),
    });
    render(<IssueFilters tagTypes={tagTypes} />);

    typeSearch("login");
    await settle();

    const option = screen.getByText("Login button broken");
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    expect(nav.push).toHaveBeenCalledWith("/issues/i1");
  });

  it("puts the real search back when a tag is picked", async () => {
    nav.params = new URLSearchParams("q=crash");
    render(<IssueFilters tagTypes={tagTypes} />);

    typeSearch("de");
    await settle();
    expect(nav.push).toHaveBeenCalledWith("/issues?q=de");

    fireEvent.click(within(screen.getByRole("listbox")).getByText("Design"));
    expect(nav.replace).toHaveBeenCalledWith("/issues?q=crash&tags=design");
  });
});
