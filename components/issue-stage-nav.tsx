import Link from "next/link";
import type { IssueStageView } from "@/lib/issue-stage";

const views: { id: IssueStageView | null; label: string; countKey: "all" | "reported" | "confirmed" }[] = [
  { id: null, label: "All issues", countKey: "all" },
  { id: "reported", label: "Reported", countKey: "reported" },
  { id: "confirmed", label: "Confirmed", countKey: "confirmed" },
];

/** Reported and Confirmed, beside All issues. Ready is a tag, not a view. */
export function IssueStageNav({
  current,
  counts,
  hrefFor,
}: {
  current: IssueStageView | null;
  counts: { all: number; reported: number; confirmed: number };
  hrefFor: (stage: IssueStageView | null) => string;
}) {
  return (
    <nav
      aria-label="Issue stages"
      className="w-full shrink-0 space-y-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs lg:w-56"
    >
      {views.map((view) => {
        const active = current === view.id;
        return (
          <Link
            key={view.label}
            href={hrefFor(view.id)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="truncate">{view.label}</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                active ? "bg-blue-100 text-blue-800" : "text-slate-600"
              }`}
            >
              {counts[view.countKey]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
