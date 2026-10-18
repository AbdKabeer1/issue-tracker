import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("page=2&q=crash"),
}));

describe("IssueFilters (#132)", () => {
  it("renders correctly with search param default value", async () => {
    const { IssueFilters } = await import("./issue-filters");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup(createElement(IssueFilters));
    expect(html).toContain('value="crash"');
  });
});
