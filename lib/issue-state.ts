import type { Status } from "@prisma/client";
import { statusLabel } from "@/lib/labels";

/**
 * Resolved and closed issues are finished: nothing on them is waiting for
 * anyone. The list de-emphasises them so the eye lands on what still needs
 * work (#313).
 */
export function isDone(status: Status | string): boolean {
  return status === "resolved" || status === "closed";
}

/**
 * The result-count line under the list heading, naming the status filter
 * when one is applied so it is clear what is being left out — "12 open
 * issues", not "12 results" — and plain when none is.
 */
export function resultCountText(count: number, status: Status | null): string {
  if (!status) return `${count} ${count === 1 ? "result" : "results"}`;
  const label = statusLabel[status].toLowerCase();
  return `${count} ${label} ${count === 1 ? "issue" : "issues"}`;
}
