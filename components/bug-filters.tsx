"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { severities, statuses } from "@/lib/validations/bug";
import { severityLabel, statusLabel } from "@/lib/labels";

export function BugFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.push(`/bugs?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-600">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search title or description"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              update("q", (event.target as HTMLInputElement).value.trim());
            }
          }}
          onBlur={(event) => update("q", event.target.value.trim())}
        />
      </div>
      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Status
        </label>
        <select
          id="status"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
      <div>
        <label
          htmlFor="severity"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Severity
        </label>
        <select
          id="severity"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
    </div>
  );
}
