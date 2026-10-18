import { describe, expect, it } from "vitest";
import {
  looksLikeMarkdown,
  inlineImageSrc,
  safeHref,
  stripMarkdown,
  stripLegacyMarkup,
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

describe("stripLegacyMarkup", () => {
  it("drops legacy underline tags but keeps their text", () => {
    expect(stripLegacyMarkup("<u>hi</u> there")).toBe("hi there");
    expect(stripLegacyMarkup("a&nbsp;b")).toBe("a b");
  });

  it("keeps tag-like text so it is displayed as typed (#116)", () => {
    const text = "The <Button> component crashes when List<String> is empty, see <Provider>.";
    expect(stripLegacyMarkup(text)).toBe(text);
    // Shown as literal text by React, never executed.
    expect(stripLegacyMarkup('<img src=x onerror="alert(1)">')).toBe('<img src=x onerror="alert(1)">');
    expect(stripLegacyMarkup("a < b")).toBe("a < b");
  });

  it("never touches code, even <u>", () => {
    const fenced = "```html\n<u>keep</u>\n<div>x</div>\n```";
    expect(stripLegacyMarkup(fenced)).toBe(fenced);
    expect(stripLegacyMarkup("use `<u>` for underline")).toBe("use `<u>` for underline");
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

describe("inlineImageSrc (#119)", () => {
  it("allows GitHub attachment and avatar images over https", () => {
    for (const url of [
      "https://github.com/user-attachments/assets/abc123",
      "https://user-images.githubusercontent.com/1/shot.png",
      "https://private-user-images.githubusercontent.com/1/shot.png?jwt=x",
      "https://avatars.githubusercontent.com/u/1?v=4",
    ]) {
      expect(inlineImageSrc(url)).toBe(url);
    }
  });

  it("rejects images from other servers (tracking pixels)", () => {
    expect(inlineImageSrc("https://attacker.example/pixel.png?id=1")).toBeNull();
    expect(inlineImageSrc("https://github.com/someone/avatar.png")).toBeNull();
    expect(
      inlineImageSrc("https://avatars.githubusercontent.com.evil.example/x.png"),
    ).toBeNull();
  });

  it("rejects non-https and unsafe sources", () => {
    expect(inlineImageSrc("http://avatars.githubusercontent.com/u/1")).toBeNull();
    expect(inlineImageSrc("javascript:alert(1)")).toBeNull();
    expect(inlineImageSrc("mailto:dev@example.com")).toBeNull();
  });
});

describe("own attachments (#305)", () => {
  it("loads this tracker's uploaded images inline and links its files", async () => {
    const { inlineImageSrc, safeHref } = await import("./rich-text");
    expect(inlineImageSrc("/api/attachments/clabc12345")).toBe("/api/attachments/clabc12345");
    expect(safeHref("/api/attachments/clabc12345")).toBe("/api/attachments/clabc12345");
  });
  it("still refuses other relative or odd paths", async () => {
    const { inlineImageSrc, safeHref } = await import("./rich-text");
    expect(safeHref("/admin/users")).toBeNull();
    expect(safeHref("/api/attachments/../../etc")).toBeNull();
    expect(inlineImageSrc("//evil.example/x.png")).toBeNull();
  });
});

describe("looksLikeMarkdown with only an uploaded image (#305)", () => {
  it("renders a description whose only Markdown is a pasted image", async () => {
    const { looksLikeMarkdown } = await import("./rich-text");
    expect(looksLikeMarkdown("It crashes.\n![shot.png](/api/attachments/clabc12345)")).toBe(true);
  });
});
