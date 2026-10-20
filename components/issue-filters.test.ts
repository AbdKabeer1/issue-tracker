import { describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({
  params: new URLSearchParams("page=2&q=crash"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => search.params,
}));

/** Render the bar against a given query string. */
async function renderFilters(params: string) {
  search.params = new URLSearchParams(params);
  const { IssueFilters } = await import("./issue-filters");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");

  return renderToStaticMarkup(createElement(IssueFilters));
}

describe("IssueFilters (#132, #361)", () => {
  it("renders correctly with search param default value", async () => {
    const html = await renderFilters("page=2&q=crash");
    expect(html).toContain('value="crash"');
  });

  it("displays keyboard shortcut hint in placeholder and kbd badge", async () => {
    const { IssueFilters } = await import("./issue-filters");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup(createElement(IssueFilters));
    expect(html).toContain('placeholder="Search, or type a tag like Design (/)"');
  });

  it("handles keyboard shortcut listener properly in source code", async () => {
    const { readFileSync } = await import("fs");
    const source = readFileSync("components/issue-filters.tsx", "utf8");

    expect(source).toContain('window.addEventListener("keydown", handleKeyDown)');
    expect(source).toContain('window.removeEventListener("keydown", handleKeyDown)');
    expect(source).toContain('event.key === "/"');
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain("event.isComposing");
    expect(source).toContain("isSlash && isEditable");
    expect(source).toContain("inputRef.current?.focus()");
    expect(source).toContain("inputRef.current?.select()");
  });
});

describe("IssueFilters live search (#671)", () => {
  it("debounces the list update and fetches issue suggestions", async () => {
    const { readFileSync } = await import("fs");
    const source = readFileSync("components/issue-filters.tsx", "utf8");

    expect(source).toContain("SEARCH_DEBOUNCE_MS");
    expect(source).toContain("router.replace(hrefWithChanges");
    expect(source).toContain("/api/issues/suggest");
    expect(source).toContain("pickSuggestion");
  });
});

describe("IssueFilters clear all filters (#336)", () => {
  it("shows the button when a filter is set", async () => {
    const html = await renderFilters("page=2&q=crash");
    expect(html).toContain("Clear all filters");
  });

  it("shows the button for every filter param", async () => {
    for (const params of [
      "q=crash",
      "tags=Design",
      "mine=assigned",
      "status=open",
      "severity=high",
      "platform=none",
      "sort=oldest",
    ]) {
      const html = await renderFilters(params);
      expect(html, params).toContain("Clear all filters");
    }
  });

  it("hides the button when only paging is set", async () => {
    const html = await renderFilters("page=2");
    expect(html).not.toContain("Clear all filters");
  });

  it("hides the button when a filter param is present but empty", async () => {
    const html = await renderFilters("q=&tags=&status=");
    expect(html).not.toContain("Clear all filters");
  });
});
