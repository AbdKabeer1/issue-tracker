/**
 * A small line + word diff for issue descriptions (#303).
 *
 * Descriptions are Markdown, so the diff works on source lines (a heading,
 * a list item, a paragraph line each stay whole) and then highlights the
 * changed words inside a line that was edited rather than rewritten. That
 * reads like a document diff instead of a wall of red and green.
 *
 * Plain LCS: descriptions are capped at 5,000 characters, so the quadratic
 * table stays small.
 */

export type Segment = { text: string; changed: boolean };

export type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "added"; segments: Segment[] }
  | { kind: "removed"; segments: Segment[] };

function lcsTable<T>(a: T[], b: T[]): number[][] {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  return t;
}

type Op<T> = { op: "same" | "del" | "add"; value: T };

function diffSeq<T>(a: T[], b: T[]): Op<T>[] {
  const t = lcsTable(a, b);
  const out: Op<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: "same", value: a[i] });
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) {
      out.push({ op: "del", value: a[i++] });
    } else {
      out.push({ op: "add", value: b[j++] });
    }
  }
  while (i < a.length) out.push({ op: "del", value: a[i++] });
  while (j < b.length) out.push({ op: "add", value: b[j++] });
  return out;
}

/** Words and the whitespace/punctuation between them, so joins are exact. */
function tokenize(line: string): string[] {
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function merge(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** Word-level highlight for one edited line. */
export function wordDiff(before: string, after: string): { removed: Segment[]; added: Segment[] } {
  const ops = diffSeq(tokenize(before), tokenize(after));
  const removed: Segment[] = [];
  const added: Segment[] = [];
  for (const { op, value } of ops) {
    if (op === "same") {
      removed.push({ text: value, changed: false });
      added.push({ text: value, changed: false });
    } else if (op === "del") removed.push({ text: value, changed: true });
    else added.push({ text: value, changed: true });
  }
  return { removed: merge(removed), added: merge(added) };
}

/** Lines this similar are an edit of each other; less, a rewrite. */
const EDIT_SIMILARITY = 0.4;

function similarity(a: string, b: string): number {
  const ta = tokenize(a).filter((t) => t.trim());
  const tb = tokenize(b).filter((t) => t.trim());
  if (ta.length === 0 || tb.length === 0) return 0;
  const common = lcsTable(ta, tb)[0][0];
  return (2 * common) / (ta.length + tb.length);
}

const whole = (text: string, changed: boolean): Segment[] => [{ text, changed }];

export function diffLines(before: string, after: string): DiffLine[] {
  const split = (s: string) => s.replace(/\r\n?/g, "\n").split("\n");
  const ops = diffSeq(split(before), split(after));
  const out: DiffLine[] = [];

  // A run of deletions followed by a run of additions is a block that
  // changed; pair its lines up so edited ones get word highlights.
  for (let k = 0; k < ops.length; ) {
    if (ops[k].op === "same") {
      out.push({ kind: "same", text: ops[k].value });
      k++;
      continue;
    }
    const dels: string[] = [];
    const adds: string[] = [];
    while (k < ops.length && ops[k].op === "del") dels.push(ops[k++].value);
    while (k < ops.length && ops[k].op === "add") adds.push(ops[k++].value);
    const pairs = Math.min(dels.length, adds.length);
    const removedLines: DiffLine[] = [];
    const addedLines: DiffLine[] = [];
    for (let p = 0; p < Math.max(dels.length, adds.length); p++) {
      const d = dels[p];
      const a = adds[p];
      if (p < pairs && similarity(d, a) >= EDIT_SIMILARITY) {
        const w = wordDiff(d, a);
        removedLines.push({ kind: "removed", segments: w.removed });
        addedLines.push({ kind: "added", segments: w.added });
      } else {
        if (d !== undefined) removedLines.push({ kind: "removed", segments: whole(d, true) });
        if (a !== undefined) addedLines.push({ kind: "added", segments: whole(a, true) });
      }
    }
    out.push(...removedLines, ...addedLines);
  }
  return out;
}

export type DiffHunk = { lines: DiffLine[] } | { skipped: number };

/**
 * Keeps `context` unchanged lines around each change and folds the rest,
 * so a one-word fix in a long report isn't buried.
 */
export function foldUnchanged(lines: DiffLine[], context = 2): DiffHunk[] {
  const keep = lines.map(() => false);
  lines.forEach((line, i) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const hunks: DiffHunk[] = [];
  let run: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (skipped) hunks.push({ skipped });
      skipped = 0;
      run.push(line);
    } else {
      if (run.length) hunks.push({ lines: run });
      run = [];
      skipped++;
    }
  });
  if (run.length) hunks.push({ lines: run });
  if (skipped) hunks.push({ skipped });
  return hunks;
}
