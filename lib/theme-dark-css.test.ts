import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * app/theme-dark.css is generated (scripts/generate-dark-palette.mjs). These
 * keep it whole: both ways into dark mode, screens only, every family the
 * app uses, and the surfaces that make the stacking work.
 */
const css = readFileSync(path.join(__dirname, "../app/theme-dark.css"), "utf8");

describe("generated dark palette (#277)", () => {
  it("applies for System on a dark device and for an explicit Dark, on screens only", () => {
    expect(css).toContain('@media screen and (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).not.toMatch(/@media print/);
  });

  it("covers every colour family the app uses, in both blocks", () => {
    for (const family of ["slate", "teal", "red", "amber", "emerald", "rose", "blue", "indigo", "violet", "sky", "purple", "pink", "zinc", "orange", "lime", "fuchsia"]) {
      for (const shade of [50, 100, 500, 700, 900, 950]) {
        const matches = css.match(new RegExp(`--color-${family}-${shade}:`, "g")) ?? [];
        expect(matches.length, `${family}-${shade}`).toBe(2);
      }
    }
  });

  it("makes white the card surface and keeps native controls dark", () => {
    expect(css.match(/--color-white:/g)).toHaveLength(2);
    expect(css.match(/color-scheme: dark;/g)).toHaveLength(2);
    expect(css).not.toMatch(/--color-black:/);
  });
});
