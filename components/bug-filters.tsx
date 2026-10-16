"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { severities, statuses } from "@/lib/validations/bug";
import { severityLabel, statusLabel } from "@/lib/labels";
import {
  BUG_SORT_OPTIONS,
  bugSortLabels,
  parseBugSort,
} from "@/lib/bugs-sort";
import {
  MINE_FILTER_OPTIONS,
  mineFilterLabels,
  parseMineFilter,
} from "@/lib/mine-filter";

export function BugFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    if ((params.get(key) ?? "") === value) return;
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/bugs?${qs}` : "/bugs");
  }

  const currentSort = parseBugSort(params.get("sort"));
  const currentMine = parseMineFilter(params.get("mine")) ?? "";

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="col-span-2 min-w-0 sm:min-w-[200px] sm:flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-600">
          Search
        </label>
        <input
          id="q"
          name="q"
          // #204: correct only because the parent keys this component on the
          // current `q` value, which remounts it whenever the URL query
          // changes (including via the browser Back button). See
          // app/(app)/bugs/page.tsx.
          defaultValue={params.get("q") ?? ""}
          placeholder="Search title or description"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const val = (event.target as HTMLInputElement).value.trim();
              if (val !== (params.get("q") ?? "")) {
                update("q", val);
              }
            }
          }}
          onBlur={(event) => {
            const val = event.target.value.trim();
            if (val !== (params.get("q") ?? "")) {
              update("q", val);
            }
          }}
        />
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="mine"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Show
        </label>
        <select
          id="mine"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={currentMine}
          onChange={(event) => update("mine", event.target.value)}
        >
          <option value="">All issues</option>
          {MINE_FILTER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {mineFilterLabels[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Status
        </label>
        <select
          id="status"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={params.get("status") ?? ""}
          onChange={(event) => update("status", event.target.value)}
        >
          <option value="">All</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="severity"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Severity
        </label>
        <select
          id="severity"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={params.get("severity") ?? ""}
          onChange={(event) => update("severity", event.target.value)}
        >
          <option value="">All</option>
          {severities.map((severity) => (
            <option key={severity} value={severity}>
              {severityLabel[severity]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="sort"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Sort
        </label>
        <select
          id="sort"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={currentSort}
          onChange={(event) => update("sort", event.target.value)}
        >
          {BUG_SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {bugSortLabels[option]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
