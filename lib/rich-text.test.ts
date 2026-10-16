import { describe, expect, it } from "vitest";
import {
  looksLikeMarkdown,
  safeHref,
  stripMarkdown,
  stripUnsafeHtmlTags,
  wrapSelection,
} from "./rich-text";

describe("looksLikeMarkdown", () => {
  it("detects common markdown markers", () => {
    expect(looksLikeMarkdown("plain text only")).toBe(false);
    expect(looksLikeMarkdown("**bold**")).toBe(true);
    expect(looksLikeMarkdown("- item")).toBe(true);
    expect(looksLikeMarkdown("- [ ] item")).toBe(true);
    expect(looksLikeMarkdown("[x](https://a.com)")).toBe(true);
    expect(looksLikeMarkdown("## heading")).toBe(true);
    expect(looksLikeMarkdown("> quoted")).toBe(true);
    expect(looksLikeMarkdown("~~gone~~")).toBe(true);
    expect(looksLikeMarkdown("<u>hi</u>")).toBe(false);
  });
});

describe("stripUnsafeHtmlTags", () => {
  it("removes raw html so it renders as text", () => {
    expect(stripUnsafeHtmlTags("<u>hi</u>")).toBe("hi");
    expect(stripUnsafeHtmlTags('<img src=x onerror="alert(1)">')).toBe("");
    expect(stripUnsafeHtmlTags("<script>alert(1)</script>ok")).toBe("alert(1)ok");
    expect(stripUnsafeHtmlTags("a < b")).toBe("a < b");
  });
});

describe("stripMarkdown", () => {
  it("removes markup for snippets", () => {
    expect(stripMarkdown("**Hello** _world_")).toBe("Hello world");
    expect(stripMarkdown("[docs](https://example.com)")).toBe("docs");
    expect(stripMarkdown("```\ncode\n```")).toBe("");
  });

  it("removes newer markdown constructs", () => {
    expect(stripMarkdown("## Heading")).toBe("Heading");
    expect(stripMarkdown("> quoted line")).toBe("quoted line");
    expect(stripMarkdown("- [ ] task item")).toBe("task item");
    expect(stripMarkdown("~~removed~~")).toBe("removed");
    expect(stripMarkdown("before\n\n---\n\nafter")).toBe("before after");
  });
});

describe("safeHref", () => {
  it("allows only http(s) and mailto", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("mailto:dev@example.com")).toBe("mailto:dev@example.com");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
    expect(safeHref("java\u0000script:alert(1)")).toBeNull();
  });
});

describe("wrapSelection", () => {
  it("wraps bold around selection", () => {
    const result = wrapSelection("say hi", 4, 6, "bold");
    expect(result.value).toBe("say **hi**");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      "hi",
    );
  });

  it("inserts placeholder when selection is empty", () => {
    const result = wrapSelection("", 0, 0, "italic");
    expect(result.value).toBe("*italic text*");
  });

  it("prefixes list lines", () => {
    const result = wrapSelection("a\nb", 0, 3, "ul");
    expect(result.value).toBe("- a\n- b");
  });
});
