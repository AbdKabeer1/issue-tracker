import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The contributor docs name this repo and product, not the old ones (#565). */
const DOCS = ["README.md", "AGENTS.md", "CONTRIBUTING.md"];

describe("contributor docs (#565)", () => {
  it.each(DOCS)("%s sends PRs to Zedu-Endor/issue-tracker", (file) => {
    const text = readFileSync(file, "utf8");
    // "formerly Zedu-Endor/bug-tracker" is fine; targeting it is not.
    expect(text).not.toMatch(/(?:target|against)[^\n]*`Zedu-Endor\/bug-tracker`/i);
    expect(text).not.toMatch(/on `Zedu-Endor\/bug-tracker`/);
  });

  it.each(DOCS)("%s has no old product name or personal paths", (file) => {
    const text = readFileSync(file, "utf8");
    expect(text).not.toContain("Zedu Bugs");
    expect(text).not.toMatch(/\/Users\/[a-z]+\//i);
  });
});
