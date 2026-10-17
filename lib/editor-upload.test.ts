import { describe, expect, it } from "vitest";
import {
  escapeLabel,
  filesFrom,
  isFileDrag,
  markdownFor,
  nameForPasted,
  placeholderFor,
  replacePlaceholder,
} from "./editor-upload";

describe("editor uploads (#305)", () => {
  it("makes an image for images and a link for anything else", () => {
    expect(markdownFor({ filename: "shot.png", contentType: "image/png" }, "abc12345")).toBe(
      "![shot.png](/api/attachments/abc12345)",
    );
    expect(markdownFor({ filename: "console.log", contentType: "text/plain" }, "abc12345")).toBe(
      "[console.log](/api/attachments/abc12345)",
    );
  });

  it("escapes names that would break the Markdown", () => {
    expect(escapeLabel("a]b[c\\d")).toBe("a\\]b\\[c\\\\d");
    expect(escapeLabel("two\nlines")).toBe("two lines");
    expect(escapeLabel("   ")).toBe("file");
  });

  it("swaps the placeholder wherever it has moved to", () => {
    const ph = placeholderFor("t1", "shot.png");
    const text = `Steps:\n${ph}\nmore`;
    const typedBefore = `New intro. ${text}`;
    expect(replacePlaceholder(typedBefore, "t1", "![shot.png](/api/attachments/x1234567)")).toBe(
      "New intro. Steps:\n![shot.png](/api/attachments/x1234567)\nmore",
    );
  });

  it("removes the placeholder entirely on failure, leaving no broken Markdown", () => {
    const text = `a ${placeholderFor("t2", "big.png")} b`;
    expect(replacePlaceholder(text, "t2", "")).toBe("a  b");
  });

  it("only touches its own placeholder, and gives up if it was deleted", () => {
    const text = `${placeholderFor("t1", "one.png")} ${placeholderFor("t2", "two.png")}`;
    expect(replacePlaceholder(text, "t2", "X")).toBe(`${placeholderFor("t1", "one.png")} X`);
    expect(replacePlaceholder("nothing here", "t3", "X")).toBeNull();
  });

  it("names pasted screenshots and keeps real names", () => {
    expect(nameForPasted({ name: "image.png", type: "image/png" }, new Date("2026-10-18T05:30:00Z"))).toBe(
      "screenshot-2026-10-18-05-30-00.png",
    );
    expect(nameForPasted({ name: "crash.jpg", type: "image/jpeg" })).toBe("crash.jpg");
  });

  it("recognises file drags and caps the files taken", () => {
    expect(isFileDrag(["text/plain"])).toBe(false);
    expect(isFileDrag(["Files"])).toBe(true);
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `${i}` }) as File);
    expect(filesFrom({ files: many })).toHaveLength(5);
    expect(filesFrom(null)).toEqual([]);
  });
});
