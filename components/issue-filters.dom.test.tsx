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
    expect(nav.replace).not.toHaveBeenCalled();

    await settle();
    expect(nav.replace).toHaveBeenCalledWith("/issues?q=login");
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
    expect(nav.replace).toHaveBeenCalledWith("/issues?q=de");

    fireEvent.click(within(screen.getByRole("listbox")).getByText("Design"));
    expect(nav.push).toHaveBeenCalledWith("/issues?q=crash&tags=design");
  });
});
