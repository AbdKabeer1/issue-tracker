import { diffLines, foldUnchanged, type Segment } from "@/lib/text-diff";

function Segments({ segments, tone }: { segments: Segment[]; tone: "added" | "removed" }) {
  const mark =
    tone === "added" ? "rounded-sm bg-emerald-200/80 text-emerald-950" : "rounded-sm bg-red-200/80 text-red-950";
  return (
    <>
      {segments.map((s, i) =>
        s.changed ? (
          <span key={i} className={mark}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/**
 * The Markdown source, line by line, with edited words highlighted (#303).
 * Uses <ins>/<del> plus visible +/− so the change isn't colour-only.
 */
export function TextDiffView({ before, after }: { before: string; after: string }) {
  const hunks = foldUnchanged(diffLines(before, after));
  const changed = hunks.some((h) => "lines" in h && h.lines.some((l) => l.kind !== "same"));
  if (!changed) {
    return <p className="text-sm text-slate-500">The description did not change.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs leading-5">
      {hunks.map((hunk, h) =>
        "skipped" in hunk ? (
          <p key={h} className="border-y border-slate-200 bg-slate-100 px-3 py-1 text-slate-500">
            {hunk.skipped} unchanged line{hunk.skipped === 1 ? "" : "s"}
          </p>
        ) : (
          hunk.lines.map((line, i) => {
            const key = `${h}-${i}`;
            if (line.kind === "same") {
              return (
                <div key={key} className="flex whitespace-pre-wrap break-words px-3 text-slate-600">
                  <span aria-hidden className="w-4 shrink-0 select-none text-slate-400"> </span>
                  <span className="min-w-0">{line.text || " "}</span>
                </div>
              );
            }
            const added = line.kind === "added";
            const Tag = added ? "ins" : "del";
            return (
              <Tag
                key={key}
                className={`flex whitespace-pre-wrap break-words px-3 no-underline ${
                  added ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
                }`}
              >
                <span aria-hidden className="w-4 shrink-0 select-none font-semibold">
                  {added ? "+" : "−"}
                </span>
                <span className="sr-only">{added ? "Added: " : "Removed: "}</span>
                <span className="min-w-0">
                  {line.segments.every((s) => !s.text) ? " " : <Segments segments={line.segments} tone={line.kind} />}
                </span>
              </Tag>
            );
          })
        ),
      )}
    </div>
  );
}
