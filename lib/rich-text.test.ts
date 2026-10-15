import { describe, expect, it } from "vitest";
import {
  looksLikeMarkdown,
  safeHref,
  stripMarkdown,
  wrapSelection,
} from "./rich-text";

describe("looksLikeMarkdown", () => {
  it("detects common markdown markers", () => {
    expect(looksLikeMarkdown("plain text only")).toBe(false);
    expect(looksLikeMarkdown("**bold**")).toBe(true);
    expect(looksLikeMarkdown("- item")).toBe(true);
    expect(looksLikeMarkdown("[x](https://a.com)")).toBe(true);
    expect(looksLikeMarkdown("<u>hi</u>")).toBe(true);
  });
});

describe("stripMarkdown", () => {
  it("removes markup for snippets", () => {
    expect(stripMarkdown("**Hello** _world_")).toBe("Hello world");
    expect(stripMarkdown("[docs](https://example.com)")).toBe("docs");
    expect(stripMarkdown("```\ncode\n```")).toBe("");
  });
});

describe("safeHref", () => {
  it("allows only http(s)", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
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
