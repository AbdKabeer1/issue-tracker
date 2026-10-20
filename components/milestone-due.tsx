"use client";

import { useSyncExternalStore } from "react";
import { dueLabel, type DueTone } from "@/lib/milestones";

const emptySubscribe = () => () => {};

/** Today in the viewer's own time zone, so "Due today" means their today. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toneClass: Record<DueTone, string> = {
  overdue: "border-red-200 bg-red-50 text-red-800",
  soon: "border-amber-200 bg-amber-50 text-amber-900",
  later: "border-slate-200 bg-slate-50 text-slate-700",
  done: "border-slate-200 bg-slate-100 text-slate-600",
};

/**
 * "Due in 3 days" / "Overdue by 2 days", worked out in the browser. The
 * server renders the plain date, which is also the tooltip.
 */
export function MilestoneDue({ due, isClosed = false }: { due: string | null; isClosed?: boolean }) {
  const today = useSyncExternalStore(emptySubscribe, localToday, () => null);
  if (!due) {
    return isClosed ? <span className={`rounded-full border px-2 py-0.5 text-xs ${toneClass.done}`}>Closed</span> : null;
  }
  const date = new Date(`${due}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const label = today ? dueLabel(due, today, isClosed) : { text: `Due ${date}`, tone: "later" as const };
  return (
    <span
      title={`Due ${date}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[label.tone]}`}
    >
      {label.text}
      {label.tone !== "done" && today ? <span className="sr-only"> ({date})</span> : null}
    </span>
  );
}
