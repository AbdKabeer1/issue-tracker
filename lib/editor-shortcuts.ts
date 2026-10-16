/**
 * Keyboard shortcuts for the Markdown editor, matching GitHub's defaults.
 * Pure mapping only — the component applies the returned action.
 */

import type { FormatAction } from "./markdown-toolbar";

export type ShortcutEventLike = {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
};

export type ShortcutOptions = {
  /** Tab / Shift+Tab only map to indent / outdent inside a list. */
  inList?: boolean;
};

export type ShortcutMatch = {
  action: FormatAction;
  /** Human-readable hint for toolbar tooltips. */
  shortcut: string;
  /** True when the browser must call preventDefault. */
  requiresControl: boolean;
};

/** `⌘` on macOS, `Ctrl` elsewhere. */
export function isModifierPressed(event: ShortcutEventLike): boolean {
  return Boolean(event.ctrlKey || event.metaKey);
}

/** GitHub-style labels: `⌘⇧X` on macOS, `Ctrl+Shift+X` elsewhere. */
export function shortcutLabel(event: Pick<ShortcutEventLike, "key" | "shiftKey">, isApple = false): string {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const parts = [isApple ? "⌘" : "Ctrl+"];
  if (event.shiftKey) parts.push(isApple ? "⇧" : "Shift+");
  parts.push(key);
  return isApple ? parts.join("") : parts.join("");
}

const BASE_KEYS: Record<string, FormatAction> = {
  b: "bold",
  i: "italic",
  e: "code",
  k: "link",
  x: "strikethrough",
};

const SHIFT_KEYS: Record<string, FormatAction> = {
  e: "codeBlock",
  "1": "heading1",
  "2": "heading2",
  "3": "heading3",
  "7": "ol",
  "8": "ul",
  "9": "task",
  ".": "quote",
};

/**
 * Resolve a keydown to a formatting action, or null when the editor should
 * keep the browser default (including Tab outside a list).
 */
export function matchShortcut(
  event: ShortcutEventLike,
  options: ShortcutOptions = {},
): ShortcutMatch | null {
  if (event.altKey) return null;

  if (event.key === "Tab") {
    if (!options.inList) return null;
    return {
      action: event.shiftKey ? "outdent" : "indent",
      shortcut: event.shiftKey ? "Shift+Tab" : "Tab",
      requiresControl: false,
    };
  }

  if (event.key.length !== 1) return null;

  const key = event.key;
  const isApple =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isModifierPressed(event)) {
    const normalized = key.toLowerCase();
    const action = event.shiftKey
      ? (SHIFT_KEYS[normalized] ?? BASE_KEYS[normalized])
      : BASE_KEYS[normalized];
    if (!action) return null;
    return {
      action,
      shortcut: shortcutLabel({ key, shiftKey: event.shiftKey }, isApple),
      requiresControl: true,
    };
  }

  return null;
}