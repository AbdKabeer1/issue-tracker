import { describe, expect, it } from "vitest";
import {
  applyFormat,
  isSelectionInList,
  type FormatAction,
} from "./markdown-toolbar";

const run = (value: string, start: number, end: number, action: FormatAction) =>
  applyFormat(value, start, end, action);

describe("applyFormat inline", () => {
  it("wraps a selection in bold", () => {
    const result = run("say hi", 4, 6, "bold");
    expect(result.value).toBe("say **hi**");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("hi");
  });

  it("toggles bold off when the selection is already wrapped", () => {
    const result = run("say **hi**", 6, 8, "bold");
    expect(result.value).toBe("say hi");
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(6);
  });

  it("unwraps the run when the caret sits inside markers", () => {
    const result = run("say **hi**", 7, 8, "bold");
    expect(result.value).toBe("say hi");
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(6);
  });

  it("inserts a placeholder when nothing is selected", () => {
    expect(run("", 0, 0, "italic").value).toBe("*italic text*");
    expect(run("", 0, 0, "strikethrough").value).toBe("~~struck text~~");
    expect(run("", 0, 0, "code").value).toBe("`code`");
  });

  it("keeps caret inside inserted markers", () => {
    const result = run("hi", 2, 2, "bold");
    expect(result.value).toBe("hi**bold text**");
    expect(result.selectionStart).toBe(4);
  });
});

describe("applyFormat headings", () => {
  it("sets a heading on the caret line", () => {
    const result = run("Title\nbody", 2, 2, "heading2");
    expect(result.value).toBe("## Title\nbody");
    expect(result.selectionStart).toBe(5);
  });

  it("replaces an existing heading level", () => {
    const result = run("## Title", 3, 3, "heading1");
    expect(result.value).toBe("# Title");
  });

  it("toggles the same heading level off", () => {
    const result = run("## Title", 3, 3, "heading2");
    expect(result.value).toBe("Title");
  });

  it("applies to every selected line", () => {
    const result = run("a\nb", 0, 3, "heading3");
    expect(result.value).toBe("### a\n### b");
  });
});

describe("applyFormat quote", () => {
  it("quotes the whole paragraph from a bare caret", () => {
    const result = run("one\ntwo\n\nthree", 0, 0, "quote");
    expect(result.value).toBe("> one\n> two\n\nthree");
  });

  it("removes quotes from the paragraph", () => {
    const result = run("> one\n> two", 2, 2, "quote");
    expect(result.value).toBe("one\ntwo");
  });
});

describe("applyFormat lists", () => {
  it("creates a bulleted list", () => {
    expect(run("a\nb", 0, 3, "ul").value).toBe("- a\n- b");
  });

  it("creates a numbered list", () => {
    expect(run("a\nb\nc", 0, 5, "ol").value).toBe("1. a\n2. b\n3. c");
  });

  it("creates a task list", () => {
    expect(run("a", 0, 1, "task").value).toBe("- [ ] a");
  });

  it("flips an existing task checkbox", () => {
    expect(run("- [ ] a", 0, 7, "taskToggle").value).toBe("- [x] a");
    expect(run("- [x] a", 0, 7, "taskToggle").value).toBe("- [ ] a");
  });

  it("replaces list markers instead of stacking them", () => {
    expect(run("- a", 0, 3, "ol").value).toBe("1. a");
  });

  it("indents nested list items", () => {
    expect(run("- a\n- b", 0, 7, "indent").value).toBe("  - a\n  - b");
  });

  it("outdents and drops the marker at the top level", () => {
    expect(run("  - a", 0, 5, "outdent").value).toBe("- a");
    expect(run("- a", 0, 3, "outdent").value).toBe("a");
  });

  it("keeps list markers when outdenting to the top level", () => {
    expect(run("  > - a", 0, 7, "outdent").value).toBe("> - a");
  });
});

describe("applyFormat code block", () => {
  it("fences the selection", () => {
    const result = run("x", 0, 1, "codeBlock");
    expect(result.value).toBe("```\nx\n```");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("x");
  });

  it("inserts an empty fence", () => {
    expect(run("", 0, 0, "codeBlock").value).toBe("```\ncode\n```");
  });
});

describe("applyFormat link", () => {
  it("wraps the selection as the label and selects the url", () => {
    const result = run("docs", 0, 4, "link");
    expect(result.value).toBe("[docs](https://)");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("https://");
  });

  it("duplicates a selected url", () => {
    const result = run("https://a.com", 0, 13, "link");
    expect(result.value).toBe("[https://a.com](https://a.com)");
  });
});

describe("isSelectionInList", () => {
  it("detects list lines", () => {
    expect(isSelectionInList("- a", 0, 3)).toBe(true);
    expect(isSelectionInList("  1. a\n  2. b", 0, 15)).toBe(true);
    expect(isSelectionInList("- a\nplain", 0, 11)).toBe(false);
    expect(isSelectionInList("", 0, 0)).toBe(false);
  });
});