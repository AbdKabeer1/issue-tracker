import { describe, expect, it } from "vitest";
import { IDLE, isTypingTarget, SEQUENCE_TIMEOUT_MS, shortcutFor, stepRow } from "./keyboard-shortcuts";

const body = { tagName: "BODY", closest: () => null };
const press = (key: string, extra: object = {}, target: object | null = body, state = IDLE, now = 1000) =>
  shortcutFor({ key, ...extra }, target as never, state, now);

describe("shortcutFor (#287)", () => {
  it("maps the single keys", () => {
    expect(press("/").action).toBe("focus-search");
    expect(press("j").action).toBe("next-row");
    expect(press("k").action).toBe("previous-row");
    expect(press("c").action).toBe("new-issue");
    expect(press("?").action).toBe("show-help");
    expect(press("x").action).toBeNull();
  });

  it("handles g then i / n, within the timeout only", () => {
    const g = press("g");
    expect(g.action).toBeNull();
    expect(press("i", {}, body, g.state, 1500).action).toBe("go-issues");
    expect(press("n", {}, body, g.state, 1500).action).toBe("go-notifications");
    expect(press("i", {}, body, g.state, 1000 + SEQUENCE_TIMEOUT_MS + 1).action).toBeNull();
  });

  it("never fires while typing", () => {
    for (const t of [
      { tagName: "INPUT", type: "text" },
      { tagName: "INPUT", type: "search" },
      { tagName: "TEXTAREA" },
      { tagName: "SELECT" },
      { tagName: "DIV", isContentEditable: true },
    ]) {
      expect(press("c", {}, t).action).toBeNull();
      expect(press("/", {}, t).action).toBeNull();
    }
  });

  it("still works on a checkbox or button", () => {
    expect(press("j", {}, { tagName: "INPUT", type: "checkbox", closest: () => null }).action).toBe("next-row");
    expect(press("j", {}, { tagName: "BUTTON", closest: () => null }).action).toBe("next-row");
  });

  it("stays out of dialogs, modified keys, IME composition and handled events", () => {
    expect(press("c", {}, { tagName: "BUTTON", closest: () => ({}) }).action).toBeNull();
    expect(press("c", { ctrlKey: true }).action).toBeNull();
    expect(press("k", { metaKey: true }).action).toBeNull();
    expect(press("c", { isComposing: true }).action).toBeNull();
    expect(press("c", { defaultPrevented: true }).action).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is false with no target", () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("stepRow", () => {
  it("starts at the top or bottom and stays in range", () => {
    expect(stepRow(-1, 5, 1)).toBe(0);
    expect(stepRow(-1, 5, -1)).toBe(4);
    expect(stepRow(4, 5, 1)).toBe(4);
    expect(stepRow(0, 5, -1)).toBe(0);
    expect(stepRow(2, 0, 1)).toBe(-1);
  });
});
