/**
 * Lightweight Markdown helpers for bug descriptions and comments.
 * Content is stored as Markdown (or plain text); rendering is sanitized.
 */

const MARKDOWN_HINT =
  /(\*\*|__|`|^\s*[-*+] |\^\s*\d+\. |\[.+\]\(.+\)|^#{1,3}\s|<u>)/m;

/** True when text likely contains Markdown we should render (vs plain wrap). */
export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINT.test(text);
}

/** Collapse Markdown/markup to plain text for snippets / previews. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<\/?u>/gi, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type WrapKind =
  | "bold"
  | "italic"
  | "underline"
  | "code"
  | "codeBlock"
  | "link"
  | "ul"
  | "ol";

export type WrapResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function selectedOrPlaceholder(
  value: string,
  start: number,
  end: number,
  placeholder: string,
): { before: string; selected: string; after: string; usedPlaceholder: boolean } {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const selected = value.slice(start, end);
  if (selected.length > 0) {
    return { before, selected, after, usedPlaceholder: false };
  }
  return { before, selected: placeholder, after, usedPlaceholder: true };
}

/** Wrap the current textarea selection with Markdown for the given format. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  kind: WrapKind,
): WrapResult {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));

  if (kind === "ul" || kind === "ol") {
    const { before, selected, after, usedPlaceholder } = selectedOrPlaceholder(
      value,
      safeStart,
      safeEnd,
      "List item",
    );
    const lines = selected.split("\n");
    const prefixed = lines
      .map((line, index) =>
        kind === "ul" ? `- ${line || "List item"}` : `${index + 1}. ${line || "List item"}`,
      )
      .join("\n");
    const next = `${before}${prefixed}${after}`;
    const selStart = before.length;
    const selEnd = usedPlaceholder
      ? before.length + prefixed.length
      : before.length + prefixed.length;
    return { value: next, selectionStart: selStart, selectionEnd: selEnd };
  }

  if (kind === "link") {
    const { before, selected, after } = selectedOrPlaceholder(
      value,
      safeStart,
      safeEnd,
      "link text",
    );
    const label = selected;
    const url = "https://";
    const inserted = `[${label}](${url})`;
    const next = `${before}${inserted}${after}`;
    const urlStart = before.length + label.length + 3;
    return {
      value: next,
      selectionStart: urlStart,
      selectionEnd: urlStart + url.length,
    };
  }

  if (kind === "codeBlock") {
    const { before, selected, after } = selectedOrPlaceholder(
      value,
      safeStart,
      safeEnd,
      "code",
    );
    const block = `\`\`\`\n${selected}\n\`\`\``;
    const next = `${before}${block}${after}`;
    const innerStart = before.length + 4;
    return {
      value: next,
      selectionStart: innerStart,
      selectionEnd: innerStart + selected.length,
    };
  }

  const wrappers: Record<"bold" | "italic" | "underline" | "code", [string, string, string]> = {
    bold: ["**", "**", "bold text"],
    italic: ["*", "*", "italic text"],
    underline: ["<u>", "</u>", "underlined text"],
    code: ["`", "`", "code"],
  };

  const [open, close, placeholder] = wrappers[kind];
  const { before, selected, after, usedPlaceholder } = selectedOrPlaceholder(
    value,
    safeStart,
    safeEnd,
    placeholder,
  );
  const inserted = `${open}${selected}${close}`;
  const next = `${before}${inserted}${after}`;
  const innerStart = before.length + open.length;
  return {
    value: next,
    selectionStart: innerStart,
    selectionEnd: usedPlaceholder
      ? innerStart + selected.length
      : innerStart + selected.length,
  };
}

/** Only allow http(s) URLs in rendered links. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}
