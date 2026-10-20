import type { Severity, Status } from "@prisma/client";
import type { ResolvedIssue } from "./award";

/**
 * The solver award a bulk change should write, or null when this issue is
 * not moving to resolved. Severity and assignee follow the change when it
 * sets them, otherwise the values already on the issue.
 */
export function solverAwardForBulkChange(
  bug: {
    id: string;
    tenantId: string;
    status: Status;
    severity: Severity;
    assigneeId: string | null;
  },
  change: Record<string, string | null>,
): ResolvedIssue | null {
  if (change.status !== "resolved" || bug.status === "resolved") return null;
  const assigneeId = Object.prototype.hasOwnProperty.call(change, "assigneeId")
    ? change.assigneeId
    : bug.assigneeId;
  const severity = (typeof change.severity === "string" ? change.severity : bug.severity) as Severity;
  return { id: bug.id, tenantId: bug.tenantId, severity, assigneeId };
}
