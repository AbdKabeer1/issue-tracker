"use client";

import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { wrapSelection, type WrapKind } from "@/lib/rich-text";
import { isGitHubPaste, sanitizeGitHubPaste as cleanGitHubPaste } from "@/lib/github-paste";

export type RichTextEditorHandle = {
  focus: () => void;
  getTextarea: () => HTMLTextAreaElement | null;
};

type RichTextEditorProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  footer?: ReactNode;
  /** Content layered under the field (e.g. mention suggestions). */
  overlay?: ReactNode;
  "aria-label"?: string;
  /** Whether to intercept and sanitize clipboard pastes originating from GitHub (defaults to true). */
  sanitizeGitHubPaste?: boolean;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "children"
>;

function ToolbarButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  {
    id,
    name,
    value,
    onChange,
    placeholder,
    disabled = false,
    required,
    minLength,
    maxLength,
    rows = 6,
    footer,
    overlay,
    "aria-label": ariaLabel,
    className = "",
    sanitizeGitHubPaste = true,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    getTextarea: () => textareaRef.current,
  }));

  const applyWrap = useCallback(
    (kind: WrapKind) => {
      const el = textareaRef.current;
      if (!el || disabled) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const next = wrapSelection(value, start, end, kind);
      onChange(next.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.selectionStart, next.selectionEnd);
      });
    },
    [disabled, onChange, value],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (rest.onPaste) {
        rest.onPaste(event);
        if (event.defaultPrevented) return;
      }

      if (!sanitizeGitHubPaste) return;

      const html = event.clipboardData?.getData("text/html");
      const plainText = event.clipboardData?.getData("text/plain");

      if (!isGitHubPaste(html, plainText)) {
        return;
      }

      event.preventDefault();
      const { sanitizedText, wasSanitized, message } = cleanGitHubPaste(
        html,
        plainText,
      );

      if (message) {
        setPasteNotice(message);
      }

      if (!wasSanitized) return;

      const el = textareaRef.current;
      if (!el) {
        if (sanitizedText) {
          onChange(value + sanitizedText);
        }
        return;
      }

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const nextValue = before + sanitizedText + after;
      onChange(nextValue);

      requestAnimationFrame(() => {
        el.focus();
        const newCursor = start + sanitizedText.length;
        el.setSelectionRange(newCursor, newCursor);
      });
    },
    [onChange, rest, sanitizeGitHubPaste, value],
  );

  return (
    <div className="space-y-1.5">
      {pasteNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-amber-950">GitHub paste:</span>
            <span>{pasteNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPasteNotice(null)}
            className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-950"
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
        <div
          className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1"
          role="toolbar"
          aria-label="Formatting"
        >
          <ToolbarButton
            label="Bold"
            title="Bold"
            disabled={disabled}
            onClick={() => applyWrap("bold")}
          />
          <ToolbarButton
            label="Italic"
            title="Italic"
            disabled={disabled}
            onClick={() => applyWrap("italic")}
          />
          <ToolbarButton
            label="Underline"
            title="Underline"
            disabled={disabled}
            onClick={() => applyWrap("underline")}
          />
          <ToolbarButton
            label="Bullet"
            title="Bulleted list"
            disabled={disabled}
            onClick={() => applyWrap("ul")}
          />
          <ToolbarButton
            label="Numbered"
            title="Numbered list"
            disabled={disabled}
            onClick={() => applyWrap("ol")}
          />
          <ToolbarButton
            label="Code"
            title="Inline code"
            disabled={disabled}
            onClick={() => applyWrap("code")}
          />
          <ToolbarButton
            label="Block"
            title="Code block"
            disabled={disabled}
            onClick={() => applyWrap("codeBlock")}
          />
          <ToolbarButton
            label="Link"
            title="Link"
            disabled={disabled}
            onClick={() => applyWrap("link")}
          />
        </div>
        <div className="relative">
          <Textarea
            {...rest}
            ref={textareaRef}
            id={fieldId}
            name={name}
            value={value}
            required={required}
            minLength={minLength}
            maxLength={maxLength}
            rows={rows}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={`rounded-none border-0 shadow-none focus:border-transparent focus:ring-0 ${className}`}
            onChange={(event) => onChange(event.target.value)}
            onPaste={handlePaste}
          />
          {overlay}
        </div>
      </div>
      {footer}
    </div>
  );
});
