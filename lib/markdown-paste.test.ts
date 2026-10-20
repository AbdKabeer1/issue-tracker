import { describe, expect, it } from "vitest";
import { hasRichFormatting, htmlToMarkdown, pasteToMarkdown } from "./markdown-paste";

describe("hasRichFormatting", () => {
  it("detects formatting worth converting", () => {
    expect(hasRichFormatting("<b>hi</b>")).toBe(true);
    expect(hasRichFormatting("<ul><li>hi</li></ul>")).toBe(true);
    expect(hasRichFormatting("<span>hi</span>")).toBe(false);
    expect(hasRichFormatting("")).toBe(false);
  });
});

describe("htmlToMarkdown", () => {
  it("converts inline formatting", () => {
    expect(htmlToMarkdown("<b>bold</b> and <i>italic</i>")).toBe("**bold** and *italic*");
    expect(htmlToMarkdown("<del>gone</del>")).toBe("~~gone~~");
    expect(htmlToMarkdown("<code>npm i</code>")).toBe("`npm i`");
  });

  it("converts headings and paragraphs", () => {
    expect(htmlToMarkdown("<h2>Title</h2><p>Body</p>")).toBe("## Title\nBody");
  });

  it("converts links and images", () => {
    expect(htmlToMarkdown('<a href="https://a.com">docs</a>')).toBe("[docs](https://a.com)");
    expect(htmlToMarkdown('<img src="https://a.com/x.png" alt="shot">')).toBe(
      "![shot](https://a.com/x.png)",
    );
  });

  it("drops javascript: links but keeps the label", () => {
    expect(htmlToMarkdown('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("converts lists", () => {
    expect(htmlToMarkdown("<ul><li>one</li><li>two</li></ul>")).toBe("- one\n- two");
    expect(htmlToMarkdown("<ol><li>one</li><li>two</li></ol>")).toBe("1. one\n2. two");
  });

  it("nests lists", () => {
    const html = "<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>";
    expect(htmlToMarkdown(html)).toBe("- one\n  - nested\n- two");
  });

  it("converts task lists", () => {
    const html =
      '<ul><li><input type="checkbox" checked="">done</li><li><input type="checkbox">todo</li></ul>';
    expect(htmlToMarkdown(html)).toBe("- [x] done\n- [ ] todo");
  });

  it.each(["checked", 'checked=""', 'checked="checked"', "CHECKED", 'checked="false"'])(
    "preserves the checked HTML boolean attribute %s (#751)",
    (attribute) => {
      const html = `<ul><li><input type="checkbox" ${attribute}>Done</li></ul>`;
      expect(htmlToMarkdown(html)).toBe("- [x] Done");
      expect(pasteToMarkdown({ text: "Done", html })).toBe("- [x] Done");
    },
  );

  it.each(["", "disabled", 'data-note="checked"'])(
    "keeps a checkbox without checked incomplete (%s)",
    (attribute) => {
      expect(htmlToMarkdown(`<ul><li><input type="checkbox" ${attribute}>Todo</li></ul>`)).toBe("- [ ] Todo");
    },
  );

  it("converts blockquotes and rules", () => {
    expect(htmlToMarkdown("<blockquote><p>quoted</p></blockquote>")).toBe("> quoted");
    expect(htmlToMarkdown("<p>a</p><hr><p>b</p>")).toBe("a\n---\nb");
  });

  it("converts code blocks", () => {
    expect(htmlToMarkdown("<pre><code>pnpm test\n</code></pre>")).toBe("```\npnpm test\n```");
  });

  it("ignores comments and styles copied from GitHub", () => {
    const html =
      '<!-- highlightSource: js --><div class="highlight highlight-source-js notranslate position-relative">' +
      '<pre>pnpm test</pre></div>';
    expect(htmlToMarkdown(html)).toBe("```\npnpm test\n```");
  });

  it("ignores scripts and styles", () => {
    expect(htmlToMarkdown("<style>p{color:red}</style><p>safe</p>")).toBe("safe");
    expect(htmlToMarkdown("<script>alert(1)</script>safe")).toBe("safe");
  });

  it("collapses whitespace and blank lines", () => {
    expect(htmlToMarkdown("<p>a</p><p></p><p>b</p>")).toBe("a\nb");
    expect(htmlToMarkdown("<p>a   \n   b</p>")).toBe("a b");
  });

  it("returns an empty string for empty html", () => {
    expect(htmlToMarkdown("   ")).toBe("");
  });
});

describe("pasteToMarkdown", () => {
  it("preserves a standalone rich-text link destination (#752)", () => {
    expect(pasteToMarkdown({
      text: "Read guide",
      html: '<a href="https://example.com/guide">Read guide</a>',
    })).toBe("[Read guide](https://example.com/guide)");
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe"])("keeps unsafe link %s out of pasted Markdown", (href) => {
    expect(pasteToMarkdown({ text: "Read guide", html: `<a href="${href}">Read guide</a>` })).toBe("Read guide");
  });

  it("prefers converted markdown for rich sources", () => {
    expect(
      pasteToMarkdown({
        text: "1. one\n2. two",
        html: "<ol><li>one</li><li>two</li></ol>",
      }),
    ).toBe("1. one\n2. two");
  });

  it("falls back to plain text when the source has no formatting", () => {
    expect(pasteToMarkdown({ text: "just text", html: "<span>just text</span>" })).toBe(
      "just text",
    );
  });

  it("normalises line endings and tabs on the plain path", () => {
    expect(pasteToMarkdown({ text: "a\r\n\tb", html: "" })).toBe("a\n  b");
  });

  it("keeps plain text when the html converts to nothing", () => {
    expect(pasteToMarkdown({ text: "keep me", html: "<b></b>" })).toBe("keep me");
  });
});
