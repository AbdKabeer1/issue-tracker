/**
 * Applies a text change to a textarea element while preserving the browser's
 * native undo/redo history stack (Ctrl+Z / Cmd+Z).
 *
 * Uses `document.execCommand("insertText")` over the replaced range when supported,
 * and falls back to `HTMLTextAreaElement.prototype.setRangeText` + dispatching an `input` event.
 */
export function applyTextChange(
  textarea: HTMLTextAreaElement,
  oldValue: string,
  newValue: string,
  selectionStart: number,
  selectionEnd: number,
  onChange?: (value: string) => void,
): void {
  let prefix = 0;
  while (
    prefix < oldValue.length &&
    prefix < newValue.length &&
    oldValue[prefix] === newValue[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < oldValue.length - prefix &&
    suffix < newValue.length - prefix &&
    oldValue[oldValue.length - 1 - suffix] ===
      newValue[newValue.length - 1 - suffix]
  ) {
    suffix++;
  }

  const replaceStart = prefix;
  const replaceEnd = oldValue.length - suffix;
  const replacement = newValue.slice(prefix, newValue.length - suffix);

  let success = false;
  try {
    textarea.focus();
    textarea.setSelectionRange(replaceStart, replaceEnd);
    if (
      typeof document !== "undefined" &&
      typeof document.execCommand === "function"
    ) {
      success = document.execCommand("insertText", false, replacement);
    }
  } catch {
    success = false;
  }

  if (success && textarea.value === newValue) {
    onChange?.(textarea.value);
  } else {
    if (typeof textarea.setRangeText === "function") {
      textarea.setRangeText(replacement, replaceStart, replaceEnd, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      textarea.value = newValue;
    }
    onChange?.(newValue);
  }

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  } else {
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  }
}
