import type { Severity, Status } from "@prisma/client";

export const severityLabel: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const statusLabel: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const severityLabels = severityLabel;
export const statusLabels = statusLabel;

export const severityClass: Record<Severity, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-800",
};

export const statusClass: Record<Status, string> = {
  open: "bg-sky-100 text-sky-800",
  in_progress: "bg-violet-100 text-violet-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-zinc-100 text-zinc-600",
};

/** Marks the bug's reporter wherever their name appears on the bug page. */
export const authorBadgeClass = "bg-teal-100 text-teal-800";
