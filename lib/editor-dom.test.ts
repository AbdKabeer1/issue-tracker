import { describe, expect, it, vi } from "vitest";
import { applyTextChange } from "./editor-dom";

describe("applyTextChange (#133)", () => {
  it("uses execCommand when available and falls back to setRangeText", () => {
    let textareaValue = "hello world";
    const textarea = {
      value: textareaValue,
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
      setRangeText: vi.fn((replacement: string, start: number, end: number) => {
        textareaValue =
          textareaValue.slice(0, start) + replacement + textareaValue.slice(end);
        textarea.value = textareaValue;
      }),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const onChange = vi.fn();
    applyTextChange(
      textarea,
      "hello world",
      "hello **world**",
      8,
      13,
      onChange,
    );

    expect(textarea.focus).toHaveBeenCalled();
    expect(textarea.setRangeText).toHaveBeenCalledWith(
      "**world**",
      6,
      11,
      "end",
    );
    expect(textarea.dispatchEvent).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("hello **world**");
  });

  it("handles inserting at beginning", () => {
    let textareaValue = "hello";
    const textarea = {
      value: textareaValue,
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
      setRangeText: vi.fn((replacement: string, start: number, end: number) => {
        textareaValue =
          textareaValue.slice(0, start) + replacement + textareaValue.slice(end);
        textarea.value = textareaValue;
      }),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLTextAreaElement;

    const onChange = vi.fn();
    applyTextChange(textarea, "hello", "# hello", 2, 2, onChange);

    expect(textarea.setRangeText).toHaveBeenCalledWith("# ", 0, 0, "end");
    expect(onChange).toHaveBeenCalledWith("# hello");
  });
});
