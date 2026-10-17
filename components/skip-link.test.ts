import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const skip = readFileSync("components/skip-link.tsx", "utf8");
const focus = readFileSync("components/focus-main-on-navigate.tsx", "utf8");
const layout = readFileSync("app/(app)/layout.tsx", "utf8");

describe("skip link (WCAG 2.4.1)", () => {
  it("points at the main landmark", () => {
    expect(skip).toContain('href={`#${MAIN_CONTENT_ID}`}');
    expect(skip).toContain('export const MAIN_CONTENT_ID = "main-content"');
  });

  it("is hidden until focused, then visible", () => {
    expect(skip).toContain("sr-only");
    expect(skip).toContain("focus:not-sr-only");
  });

  it("is rendered before the header, so it is the first focusable element", () => {
    const skipAt = layout.indexOf("<SkipLink />");
    const headerAt = layout.indexOf("<AppHeader");
    expect(skipAt).toBeGreaterThan(-1);
    expect(skipAt).toBeLessThan(headerAt);
  });

  it("gives main an id and makes it focusable without adding a tab stop", () => {
    expect(layout).toContain("id={MAIN_CONTENT_ID}");
    expect(layout).toContain("tabIndex={-1}");
  });
});

describe("focus after client navigation", () => {
  it("moves focus to main when the path changes", () => {
    expect(focus).toContain("usePathname()");
    expect(focus).toContain("document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true })");
  });

  it("skips the first render, which is already at the top of the document", () => {
    expect(focus).toContain("if (firstRender.current)");
  });

  it("leaves announcing to Next's own route announcer", () => {
    expect(focus).not.toContain("aria-live");
  });
});
