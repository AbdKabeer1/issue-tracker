import { describe, expect, it } from "vitest";
import { isModifierPressed, matchShortcut, shortcutLabel } from "./editor-shortcuts";

describe("isModifierPressed", () => {
  it("detects either modifier", () => {
    expect(isModifierPressed({ key: "b", metaKey: true })).toBe(true);
    expect(isModifierPressed({ key: "b", ctrlKey: true })).toBe(true);
    expect(isModifierPressed({ key: "b" })).toBe(false);
  });
});

describe("matchShortcut", () => {
  it("maps modifier combos", () => {
    expect(matchShortcut({ key: "b", metaKey: true })?.action).toBe("bold");
    expect(matchShortcut({ key: "i", ctrlKey: true })?.action).toBe("italic");
    expect(matchShortcut({ key: "e", metaKey: true })?.action).toBe("code");
    expect(matchShortcut({ key: "e", metaKey: true, shiftKey: true })?.action).toBe(
      "codeBlock",
    );
    expect(matchShortcut({ key: "1", metaKey: true, shiftKey: true })?.action).toBe(
      "heading1",
    );
    expect(matchShortcut({ key: "k", metaKey: true })?.action).toBe("link");
    expect(matchShortcut({ key: "x", metaKey: true, shiftKey: true })?.action).toBe(
      "strikethrough",
    );
    expect(matchShortcut({ key: "8", metaKey: true, shiftKey: true })?.action).toBe("ul");
    expect(matchShortcut({ key: "7", ctrlKey: true, shiftKey: true })?.action).toBe("ol");
    expect(matchShortcut({ key: "9", metaKey: true, shiftKey: true })?.action).toBe("task");
    expect(matchShortcut({ key: ".", metaKey: true, shiftKey: true })?.action).toBe("quote");
  });

  it("ignores bare shift combos so international layouts can type digits and punctuation (#124)", () => {
    expect(matchShortcut({ key: "1", shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: "2", shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: "8", shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: ".", shiftKey: true })).toBeNull();
  });

  it("ignores printable keys without a shortcut", () => {
    expect(matchShortcut({ key: "a" })).toBeNull();
    expect(matchShortcut({ key: "Enter" })).toBeNull();
    expect(matchShortcut({ key: "Escape" })).toBeNull();
    expect(matchShortcut({ key: "z", metaKey: true })).toBeNull();
    expect(matchShortcut({ key: "b", altKey: true, metaKey: true })).toBeNull();
  });

  it("maps tab to indent only inside a list", () => {
    expect(matchShortcut({ key: "Tab" })).toBeNull();
    expect(matchShortcut({ key: "Tab" }, { inList: true })?.action).toBe("indent");
    expect(matchShortcut({ key: "Tab", shiftKey: true }, { inList: true })?.action).toBe(
      "outdent",
    );
  });

  it("always requires preventDefault for matched combos", () => {
    expect(matchShortcut({ key: "b", metaKey: true })?.requiresControl).toBe(true);
    expect(matchShortcut({ key: "Tab" }, { inList: true })?.requiresControl).toBe(false);
  });
});

describe("shortcutLabel", () => {
  it("renders platform specific hints", () => {
    expect(shortcutLabel({ key: "b" }, true)).toBe("⌘B");
    expect(shortcutLabel({ key: "x", shiftKey: true }, true)).toBe("⌘⇧X");
    expect(shortcutLabel({ key: "b" }, false)).toBe("Ctrl+B");
    expect(shortcutLabel({ key: "7", shiftKey: true }, false)).toBe("Ctrl+Shift+7");
  });
});