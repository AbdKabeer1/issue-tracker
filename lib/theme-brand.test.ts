import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "../app/theme-brand.css"), "utf8");

describe("brand surfaces", () => {
  it("keeps white white in dark mode and paints cards with a separate token", () => {
    expect(css).not.toContain("--color-white: #263b63");
    expect(css.match(/--color-white: #fff;/g)).toHaveLength(2);
    expect(css.match(/--card: #0e1a33;/g)).toHaveLength(2);
  });
});
