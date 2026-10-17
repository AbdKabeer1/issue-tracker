import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_TRIAGE_ERRORS = {
  statusUnauthorized:
    "Only the assignee or an admin can change this issue's status",
} as const;

export type CanChangeTicketStatusParams = {
  actorId?: string | null;
  actorRole?: AppRole | null;
  currentAssigneeId?: string | null;
};

/**
 * Checks whether a user may change an issue's status.
 *
 * Allowed: the issue's assignee of record, or an admin / super_admin.
 *
 * Note that this is deliberately evaluated against `currentAssigneeId` - the
 * assignee the issue has *now* - and never against the assignee the request is
 * trying to set. Otherwise a user could self-assign an unassigned issue and, in
 * the same request, close it.
 */
export function canChangeTicketStatus({
  actorId,
  actorRole,
  currentAssigneeId,
}: CanChangeTicketStatusParams): boolean {
  if (!actorId) return false;
  if (isAdmin(actorRole)) return true;
  return Boolean(currentAssigneeId && actorId === currentAssigneeId);
}