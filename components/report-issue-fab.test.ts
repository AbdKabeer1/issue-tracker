import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * The floating Report issue button sits over the comment box on a phone, so it
 * hides while someone is typing. Guards the behaviour without a DOM harness.
 */
const source = readFileSync("components/report-issue-fab.tsx", "utf8");

describe("ReportIssueFab", () => {
  it("watches focus to detect typing", () => {
    expect(source).toContain('document.addEventListener("focusin"');
    expect(source).toContain('document.addEventListener("focusout"');
  });

  it("treats inputs, textareas and rich editors as typing", () => {
    for (const probe of ['"INPUT"', '"TEXTAREA"', "isContentEditable"]) {
      expect(source).toContain(probe);
    }
  });

  it("renders nothing while typing", () => {
    expect(source).toContain("if (typing) return null;");
  });

  it("removes its listeners on unmount", () => {
    expect(source).toContain('document.removeEventListener("focusin"');
    expect(source).toContain('document.removeEventListener("focusout"');
  });
});
