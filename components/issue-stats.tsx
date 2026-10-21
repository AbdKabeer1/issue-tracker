"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FINISHED_STATUS_FILTER } from "@/lib/issue-state";

interface IssueStatsProps {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
}

export function IssueStats({
  total,
  open,
  inProgress,
  closed,
}: IssueStatsProps) {
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";

  function getStatusHref(status: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (status) {
      next.set("status", status);
    } else {
      next.delete("status");
    }
    next.delete("page");
    const qs = next.toString();
    return qs ? `/issues?${qs}` : "/issues";
  }

  const stats = [
    {
      id: "total",
      label: "Total issues",
      count: total,
      statusKey: "",
      iconBg: "bg-blue-50 text-blue-600 border border-blue-100",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: "open",
      label: "Open",
      count: open,
      statusKey: "open",
      iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "in_progress",
      label: "In progress",
      count: inProgress,
      statusKey: "in_progress",
      iconBg: "bg-purple-50 text-purple-600 border border-purple-100",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "closed",
      label: "Closed",
      count: closed,
      // Resolved and closed issues are one "finished" bucket, so the tile links
      // to that same filter — the count and the list it opens agree (#685).
      statusKey: FINISHED_STATUS_FILTER,
      hint: "Resolved and closed issues",
      iconBg: "bg-slate-100 text-slate-600 border border-slate-200",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
  ];

  return (
    <section aria-label="Issue statistics" className="w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
        {stats.map((item) => {
          const isActive =
            item.statusKey === ""
              ? currentStatus === ""
              : currentStatus === item.statusKey;

          return (
            <Link
              key={item.id}
              href={getStatusHref(item.statusKey)}
              title={item.hint}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center gap-3.5 rounded-lg p-2.5 sm:p-3 transition-all ${
                isActive
                  ? "bg-slate-50 ring-1 ring-slate-200/80"
                  : "hover:bg-slate-50/70"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105 ${item.iconBg}`}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {item.count}
                </p>
                <p className="text-xs font-medium text-slate-500 truncate">
                  {item.label}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
