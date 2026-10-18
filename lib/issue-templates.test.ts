import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUG_TEMPLATE,
  initialDescription,
  isUntouchedTemplate,
  normalizeTemplate,
  templateSwitch,
} from "./issue-templates";

const BUG = DEFAULT_BUG_TEMPLATE;
const DESIGN = "### What looks wrong\n\n### Screenshot\n";

describe("normalizeTemplate", () => {
  it("treats blank as no template", () => {
    expect(normalizeTemplate("")).toBeNull();
    expect(normalizeTemplate("  \n\t ")).toBeNull();
    expect(normalizeTemplate(null)).toBeNull();
  });
  it("normalises line endings and ends with one newline", () => {
    expect(normalizeTemplate("a\r\nb\n\n\n")).toBe("a\nb\n");
  });
});

describe("isUntouchedTemplate", () => {
  it("ignores trailing whitespace and CRLF", () => {
    expect(isUntouchedTemplate(BUG.replace(/\n/g, "\r\n") + "   ", BUG)).toBe(true);
  });
  it("is false once anything is filled in", () => {
    expect(isUntouchedTemplate(BUG.replace("1.\n", "1. Open the app\n"), BUG)).toBe(false);
  });
  it("is false with no template", () => {
    expect(isUntouchedTemplate("", null)).toBe(false);
  });
});

describe("templateSwitch", () => {
  it("fills a blank description with the new type's template", () => {
    expect(templateSwitch("", null, BUG)).toEqual({ kind: "replace", text: BUG });
  });
  it("swaps an untouched template for the next one without asking", () => {
    expect(templateSwitch(BUG, BUG, DESIGN)).toEqual({ kind: "replace", text: DESIGN });
  });
  it("clears an untouched template when the next type has none", () => {
    expect(templateSwitch(BUG, BUG, null)).toEqual({ kind: "replace", text: "" });
  });
  it("asks before replacing text the reporter typed", () => {
    expect(templateSwitch("It crashes on save", null, BUG)).toEqual({ kind: "confirm", text: BUG });
    const edited = BUG.replace("### Actual\n", "### Actual\nBlank page\n");
    expect(templateSwitch(edited, BUG, DESIGN)).toEqual({ kind: "confirm", text: DESIGN });
  });
  it("leaves typed text alone when the next type has no template", () => {
    expect(templateSwitch("It crashes on save", BUG, null)).toEqual({ kind: "keep" });
    expect(templateSwitch("It crashes on save", null, "   ")).toEqual({ kind: "keep" });
  });
  it("keeps a blank field blank between types without templates", () => {
    expect(templateSwitch("", null, null)).toEqual({ kind: "keep" });
  });
});

describe("initialDescription", () => {
  it("is the template, or empty", () => {
    expect(initialDescription(BUG)).toBe(BUG);
    expect(initialDescription(null)).toBe("");
  });
});
