/**
 * Pure Markdown transforms behind the editor toolbar and keyboard shortcuts.
 *
 * Every function takes the full value plus a selection range and returns the
 * next value together with the selection to restore, so the UI layer stays
 * free of string math and everything here is unit-testable.
 */

export type EditorSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export type FormatAction =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "ul"
  | "ol"
  | "task"
  | "taskToggle"
  | "codeBlock"
  | "indent"
  | "outdent"
  | "link";

export const LIST_INDENT = "  ";

const INLINE_WRAPPERS = {
  bold: { marker: "**", placeholder: "bold text" },
  italic: { marker: "*", placeholder: "italic text" },
  strikethrough: { marker: "~~", placeholder: "struck text" },
  code: { marker: "`", placeholder: "code" },
} as const;

type InlineKind = keyof typeof INLINE_WRAPPERS;

const HEADING_LEVELS = { heading1: 1, heading2: 2, heading3: 3 } as const;

type Marker =
  | { kind: "quote" }
  | { kind: "heading"; level: number }
  | { kind: "ul" }
  | { kind: "ol"; start: number }
  | { kind: "task"; checked: boolean };

type LineMeta = { indent: string; markers: Marker[]; rest: string };

const MARKER_PATTERNS: { re: RegExp; build: (match: RegExpExecArray) => Marker }[] = [
  { re: /^>[ \t]?/, build: () => ({ kind: "quote" }) },
  { re: /^(#{1,6})(?:[ \t]+|$)/, build: (m) => ({ kind: "heading", level: m[1].length }) },
  { re: /^[-*+][ \t]+\[([ xX])\][ \t]+/, build: (m) => ({ kind: "task", checked: m[1].toLowerCase() === "x" }) },
  { re: /^[-*+][ \t]+/, build: () => ({ kind: "ul" }) },
  { re: /^(\d{1,9})[.)][ \t]+/, build: (m) => ({ kind: "ol", start: Number(m[1]) }) },
];

function parseLine(line: string): LineMeta {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? "";
  let rest = line.slice(indent.length);
  const markers: Marker[] = [];

  for (let guard = 0; guard < 12; guard += 1) {
    const hit = MARKER_PATTERNS.find((pattern) => pattern.re.test(rest));
    if (!hit) break;
    const match = hit.re.exec(rest);
    if (!match) break;
    markers.push(hit.build(match));
    rest = rest.slice(match[0].length);
  }

  return { indent, markers, rest };
}

function serializeMarker(marker: Marker): string {
  switch (marker.kind) {
    case "quote":
      return "> ";
    case "heading":
      return `${"#".repeat(marker.level)} `;
    case "ul":
      return "- ";
    case "ol":
      return `${marker.start}. `;
    case "task":
      return marker.checked ? "- [x] " : "- [ ] ";
  }
}

function serializeLine(line: LineMeta): string {
  const markers = line.markers.map(serializeMarker).join("");
  return `${line.indent}${markers}${line.rest}`;
}

function clampRange(value: string, start: number, end: number) {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  return { start: safeStart, end: safeEnd };
}

function blockStartOf(value: string, index: number): number {
  if (index <= 0) return 0;
  const previousBreak = value.lastIndexOf("\n", index - 1);
  return previousBreak + 1;
}

function blockEndOf(value: string, index: number): number {
  const nextBreak = value.indexOf("\n", index);
  return nextBreak === -1 ? value.length : nextBreak;
}

/** GitHub quotes the whole paragraph, not just the line holding the caret. */
function extendToParagraph(value: string, end: number): number {
  let cursor = end;
  while (cursor < value.length) {
    const breakIndex = value.indexOf("\n", cursor);
    const lineEnd = breakIndex === -1 ? value.length : breakIndex;
    if ((value.slice(cursor, lineEnd) ?? "").trim() === "") return cursor === end ? end : cursor;
    cursor = lineEnd + 1;
    if (breakIndex === -1) return value.length;
  }
  return value.length;
}

function lineIndexWithin(block: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index; i += 1) {
    if (block[i] === "\n") line += 1;
  }
  return line;
}

/** Transform every line of the block containing the selection. */
function withSelectedLines(
  value: string,
  start: number,
  end: number,
  transform: (lines: string[]) => string[],
): EditorSelection {
  const from = blockStartOf(value, start);
  const to = blockEndOf(value, end);
  const block = value.slice(from, to);
  // Trailing blank lines belong to the next block, never to the transform.
  const trailing = /\n+$/.exec(block)?.[0] ?? "";
  const core = trailing ? block.slice(0, block.length - trailing.length) : block;
  const original = core.split("\n");
  const transformed = transform(original).join("\n");
  const next = transformed + trailing;
  const rebuilt = value.slice(0, from) + next + value.slice(to);
  const caretLine = lineIndexWithin(core, start - from);

  if (start === end) {
    const before = original[caretLine] ?? "";
    const after = transformed.split("\n")[caretLine] ?? "";
    const caret = Math.max(from, Math.min(from + transformed.length, start + (after.length - before.length)));
    return { value: rebuilt, selectionStart: caret, selectionEnd: caret };
  }

  return {
    value: rebuilt,
    selectionStart: from,
    selectionEnd: from + next.length,
  };
}

function applyInline(
  value: string,
  start: number,
  end: number,
  kind: InlineKind,
): EditorSelection {
  const { marker, placeholder } = INLINE_WRAPPERS[kind];

  const selected = value.slice(start, end);
  const beforeMarker = value.slice(Math.max(0, start - marker.length), start);
  const afterMarker = value.slice(end, end + marker.length);

  if (beforeMarker === marker && afterMarker === marker) {
    const next = value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
    return { value: next, selectionStart: start - marker.length, selectionEnd: end - marker.length };
  }

  // Selection sits inside a wrapped run (e.g. `**he|llo**`): unwrap the run.
  const openIndex = value.lastIndexOf(marker, Math.max(0, start - 1));
  if (openIndex !== -1 && start > openIndex + marker.length) {
    const innerStart = openIndex + marker.length;
    const innerValue = value.slice(innerStart, end);
    if (
      innerValue.length > 0 &&
      !innerValue.includes(marker) &&
      afterMarker === marker
    ) {
      const next =
        value.slice(0, openIndex) + innerValue + value.slice(end + marker.length);
      return {
        value: next,
        selectionStart: openIndex,
        selectionEnd: openIndex + innerValue.length,
      };
    }
  }

  const innerText = selected.length > 0 ? selected : placeholder;
  const next = `${value.slice(0, start)}${marker}${innerText}${marker}${value.slice(end)}`;
  const caretStart = start + marker.length;
  return {
    value: next,
    selectionStart: caretStart,
    selectionEnd: caretStart + innerText.length,
  };
}

function stripMarkers(markers: Marker[], kinds: Marker["kind"][]): Marker[] {
  return markers.filter((marker) => !kinds.includes(marker.kind));
}

function setHeading(lines: string[], level: number): string[] {
  return lines.map((line) => {
    const parsed = parseLine(line);
    const alreadySet = parsed.markers.some((marker) => marker.kind === "heading" && marker.level === level);
    const markers = alreadySet
      ? stripMarkers(parsed.markers, ["heading"])
      : [...stripMarkers(parsed.markers, ["heading"]), { kind: "heading", level } as Marker];
    return serializeLine({ ...parsed, markers });
  });
}

function setList(lines: string[], kind: "ul" | "ol" | "task"): string[] {
  let counter = 0;
  return lines.map((line) => {
    const parsed = parseLine(line);
    counter += 1;
    const marker: Marker =
      kind === "ul"
        ? { kind: "ul" }
        : kind === "ol"
          ? { kind: "ol", start: counter }
          : { kind: "task", checked: false };
    const markers = [...stripMarkers(parsed.markers, ["heading", "ul", "ol", "task"]), marker];
    return serializeLine({ ...parsed, markers });
  });
}

function setQuote(lines: string[], quoted: boolean): string[] {
  return lines.map((line) => {
    const parsed = parseLine(line);
    const markers = quoted
      ? [...parsed.markers, { kind: "quote" } as Marker]
      : stripMarkers(parsed.markers, ["quote"]);
    return serializeLine({ ...parsed, markers });
  });
}

function toggleTaskCheckbox(lines: string[]): string[] {
  return lines.map((line) => {
    const parsed = parseLine(line);
    const task = parsed.markers.find((marker) => marker.kind === "task");
    if (!task) {
      const markers = [...stripMarkers(parsed.markers, ["heading", "ul", "ol", "task"]), { kind: "task", checked: false } as Marker];
      return serializeLine({ ...parsed, markers });
    }
    const markers = parsed.markers.map((marker) =>
      marker.kind === "task" ? ({ kind: "task", checked: !marker.checked } as Marker) : marker,
    );
    return serializeLine({ ...parsed, markers });
  });
}

function shiftIndent(lines: string[], direction: 1 | -1): string[] {
  return lines.map((line) => {
    const parsed = parseLine(line);
    if (direction === 1) return `${LIST_INDENT}${serializeLine(parsed)}`;

    const indent = parsed.indent.endsWith(LIST_INDENT)
      ? parsed.indent.slice(0, -LIST_INDENT.length)
      : parsed.indent.replace(/\t$/, "");
    const remaining = parseLine(line.slice(parsed.indent.length - indent.length));
    const hasOwnMarker = remaining.markers.some((marker) => marker.kind !== "quote");
    // Only drop the bullet/heading once the item is already top level.
    const markers =
      parsed.indent.length === 0 && hasOwnMarker
        ? stripMarkers(remaining.markers, ["ul", "ol", "task", "heading"])
        : remaining.markers;
    return serializeLine({ indent, markers, rest: remaining.rest });
  });
}

function insertLink(value: string, start: number, end: number): EditorSelection {
  const selected = value.slice(start, end);
  const looksLikeUrl = /^https?:\/\/\S+$/i.test(selected.trim());

  if (looksLikeUrl) {
    const inserted = `[${selected}](${selected})`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    return { value: next, selectionStart: start, selectionEnd: start + inserted.length };
  }

  const label = selected || "link text";
  const url = "https://";
  const inserted = `[${label}](${url})`;
  const next = value.slice(0, start) + inserted + value.slice(end);
  const urlStart = start + label.length + 3;
  return { value: next, selectionStart: urlStart, selectionEnd: urlStart + url.length };
}

/** Apply a toolbar/shortcut action to `value` for the given selection. */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  action: FormatAction,
): EditorSelection {
  const { start: safeStart, end: safeEnd } = clampRange(value, start, end);

  if (action in INLINE_WRAPPERS) {
    return applyInline(value, safeStart, safeEnd, action as InlineKind);
  }

  if (action === "link") {
    return insertLink(value, safeStart, safeEnd);
  }

  if (action === "codeBlock") {
    const selected = value.slice(safeStart, safeEnd);
    const code = selected || "code";
    const inserted = `\`\`\`\n${code}\n\`\`\``;
    const next = value.slice(0, safeStart) + inserted + value.slice(safeEnd);
    const innerStart = safeStart + 4;
    return {
      value: next,
      selectionStart: innerStart,
      selectionEnd: innerStart + code.length,
    };
  }

  if (action === "quote") {
    const quoteEnd = safeStart === safeEnd ? extendToParagraph(value, safeEnd) : safeEnd;
    const block = value.slice(blockStartOf(value, safeStart), blockEndOf(value, quoteEnd));
    const firstLine = block.split("\n")[0] ?? "";
    const quoted = !parseLine(firstLine).markers.some((marker) => marker.kind === "quote");
    return withSelectedLines(value, safeStart, quoteEnd, (lines) => setQuote(lines, quoted));
  }

  if (action in HEADING_LEVELS) {
    const level = HEADING_LEVELS[action as keyof typeof HEADING_LEVELS];
    return withSelectedLines(value, safeStart, safeEnd, (lines) => setHeading(lines, level));
  }

  if (action === "ul" || action === "ol" || action === "task") {
    return withSelectedLines(value, safeStart, safeEnd, (lines) => setList(lines, action));
  }

  if (action === "taskToggle") {
    return withSelectedLines(value, safeStart, safeEnd, toggleTaskCheckbox);
  }

  if (action === "indent") {
    return withSelectedLines(value, safeStart, safeEnd, (lines) => shiftIndent(lines, 1));
  }

  return withSelectedLines(value, safeStart, safeEnd, (lines) => shiftIndent(lines, -1));
}

/** True when every selected line is part of a list (so Tab should indent). */
export function isSelectionInList(value: string, start: number, end: number): boolean {
  const { start: safeStart, end: safeEnd } = clampRange(value, start, end);
  const block = value.slice(blockStartOf(value, safeStart), blockEndOf(value, safeEnd));
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return false;
  return lines.every((line) =>
    parseLine(line).markers.some((marker) =>
      marker.kind === "ul" || marker.kind === "ol" || marker.kind === "task",
    ),
  );
}