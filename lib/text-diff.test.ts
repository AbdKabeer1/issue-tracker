import { describe, expect, it } from "vitest";
import { diffLines, foldUnchanged, wordDiff } from "./text-diff";

const text = (segments: { text: string }[]) => segments.map((s) => s.text).join("");

describe("diffLines", () => {
  it("returns only unchanged lines for identical text", () => {
    expect(diffLines("a\nb", "a\nb").every((l) => l.kind === "same")).toBe(true);
  });

  it("marks inserted and deleted lines", () => {
    const d = diffLines("### Steps\n1. Open\n### Actual", "### Steps\n1. Open\n2. Save\n### Actual");
    expect(d.map((l) => l.kind)).toEqual(["same", "same", "added", "same"]);
  });

  it("highlights the changed words inside an edited line", () => {
    const d = diffLines("The button does nothing on Safari", "The button does nothing on Firefox");
    expect(d.map((l) => l.kind)).toEqual(["removed", "added"]);
    const added = d[1];
    if (added.kind !== "added") throw new Error();
    expect(text(added.segments)).toBe("The button does nothing on Firefox");
    expect(added.segments.filter((s) => s.changed).map((s) => s.text)).toEqual(["Firefox"]);
  });

  it("treats a rewritten line as a whole replacement", () => {
    const d = diffLines("Totally different", "Nothing in common here");
    expect(d.flatMap((l) => (l.kind === "same" ? [] : l.segments)).every((s) => s.changed)).toBe(true);
  });

  it("ignores CRLF differences", () => {
    expect(diffLines("a\r\nb", "a\nb").every((l) => l.kind === "same")).toBe(true);
  });
});

describe("wordDiff", () => {
  it("rejoins to the original strings exactly", () => {
    const w = wordDiff("`npm run dev` fails!", "`pnpm dev` fails, again!");
    expect(text(w.removed)).toBe("`npm run dev` fails!");
    expect(text(w.added)).toBe("`pnpm dev` fails, again!");
  });
});

describe("foldUnchanged", () => {
  it("folds long unchanged stretches but keeps context", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 10", "line ten");
    const hunks = foldUnchanged(diffLines(before, after), 2);
    expect(hunks[0]).toEqual({ skipped: 8 });
    expect("lines" in hunks[1] && hunks[1].lines.length).toBe(6);
    expect(hunks[2]).toEqual({ skipped: 7 });
  });
});
