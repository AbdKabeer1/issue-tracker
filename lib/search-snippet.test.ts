import { describe, expect, it } from "vitest";
import {
  hasMatch,
  highlightSegments,
  markdownToPlain,
  matchSnippet,
} from "./search-snippet";

const joined = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("highlightSegments", () => {
  it("marks every case-insensitive occurrence", () => {
    expect(highlightSegments("Login fails; LOGIN page", "login")).toEqual([
      { text: "Login", match: true },
      { text: " fails; ", match: false },
      { text: "LOGIN", match: true },
      { text: " page", match: false },
    ]);
  });

  it("treats regex syntax in the query literally", () => {
    const segs = highlightSegments("a.b axb (c)", "a.b");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(["a.b"]);
    expect(highlightSegments("call fn(x)", "fn(").filter((s) => s.match)).toHaveLength(1);
  });

  it("keeps HTML as text, never as markup", () => {
    const segs = highlightSegments('<img src=x onerror="alert(1)"> img', "img");
    expect(joined(segs)).toBe('<img src=x onerror="alert(1)"> img');
    expect(segs.filter((s) => s.match)).toHaveLength(2);
  });

  it("returns the whole text unmatched for a blank query, and [] for no text", () => {
    expect(highlightSegments("abc", "  ")).toEqual([{ text: "abc", match: false }]);
    expect(highlightSegments("", "a")).toEqual([]);
  });

  it("doesn't shift indices on characters whose lowercase is longer", () => {
    const segs = highlightSegments("İstanbul crash", "crash");
    expect(segs.at(-1)).toEqual({ text: "crash", match: true });
  });
});

describe("hasMatch", () => {
  it("is stateless across calls (no lastIndex carry-over)", () => {
    expect(hasMatch("crash", "crash")).toBe(true);
    expect(hasMatch("crash", "crash")).toBe(true);
    expect(hasMatch("nothing", "crash")).toBe(false);
  });
});

describe("markdownToPlain", () => {
  it("drops syntax and keeps the words", () => {
    expect(
      markdownToPlain("## Steps\n1. Open [the page](https://x.test)\n- **Click** `Save`\n```js\nboom()\n```"),
    ).toBe("Steps Open the page Click Save boom()");
  });
});

describe("matchSnippet", () => {
  const long =
    "The dashboard loads fine on desktop. " +
    "On a phone the sidebar overlaps the chart and the export button cannot be reached at all. " +
    "Tested on two devices.";

  it("returns a window around the first match with ellipsis flags", () => {
    const s = matchSnippet(long, "export", 20)!;
    expect(s.before).toBe(true);
    expect(s.after).toBe(true);
    expect(s.segments.find((x) => x.match)?.text).toBe("export");
    expect(joined(s.segments).length).toBeLessThan(60);
  });

  it("starts and ends on word boundaries", () => {
    const text = joined(matchSnippet(long, "export", 20)!.segments);
    expect(long).toContain(` ${text} `);
  });

  it("is null when the query isn't there", () => {
    expect(matchSnippet(long, "printer")).toBeNull();
    expect(matchSnippet("", "x")).toBeNull();
    expect(matchSnippet(long, " ")).toBeNull();
  });

  it("has no ellipses when the whole text fits", () => {
    expect(matchSnippet("short export text", "export")).toMatchObject({
      before: false,
      after: false,
    });
  });
});
