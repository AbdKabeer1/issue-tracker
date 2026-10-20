import { describe, expect, it } from "vitest";
import { wrapFocusIndex } from "./focus-trap";

describe("wrapFocusIndex", () => {
  it("wraps Tab from the last control to the first", () => {
    expect(wrapFocusIndex(4, 5, false)).toBe(0);
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    expect(wrapFocusIndex(0, 5, true)).toBe(4);
  });

  it("leaves the middle alone, where the browser already does the right thing", () => {
    expect(wrapFocusIndex(2, 5, false)).toBeNull();
    expect(wrapFocusIndex(2, 5, true)).toBeNull();
    expect(wrapFocusIndex(0, 5, false)).toBeNull();
    expect(wrapFocusIndex(4, 5, true)).toBeNull();
  });

  it("pulls focus that escaped the trap back to the nearest edge", () => {
    expect(wrapFocusIndex(-1, 5, false)).toBe(0);
    expect(wrapFocusIndex(-1, 5, true)).toBe(4);
  });

  it("keeps a single control focused in both directions", () => {
    expect(wrapFocusIndex(0, 1, false)).toBe(0);
    expect(wrapFocusIndex(0, 1, true)).toBe(0);
  });

  it("does nothing when there is nothing to focus", () => {
    expect(wrapFocusIndex(-1, 0, false)).toBeNull();
  });
});
