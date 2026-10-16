import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_ASSIGN_ERRORS = {
  unauthorized: "Only admins can assign issues to other users",
  unauthorizedUpdate: "Only the assignee or an admin can update this issue",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  assigneeNotFound: "Assignee not found",
  failed: "Could not update issue assignment. Please try again.",
} as const;

export type TicketAssignError = keyof typeof TICKET_ASSIGN_ERRORS;

/**
 * Checks whether an actor can assign an issue to a given target assignee.
 * - Admins and super admins can assign to any user, or unassign (targetAssigneeId = null).
 * - Normal users can assign to themselves (targetAssigneeId = actorId),
 *   provided the ticket is unassigned or already assigned to them.
 * - Normal users can unassign themselves if they are the current assignee (targetAssigneeId = null && currentAssigneeId = actorId).
 * - Normal users cannot assign to any other user or take over another user's assignment.
 */
export function canAssignTicket({
  actorId,
  actorRole,
  currentAssigneeId,
  targetAssigneeId,
}: {
  actorId: string;
  actorRole?: AppRole | null;
  currentAssigneeId?: string | null;
  targetAssigneeId?: string | null;
}): boolean {
  if (isAdmin(actorRole)) {
    return true;
  }

  // Self-assigning (only allowed if unassigned or already assigned to actor)
  if (targetAssigneeId === actorId) {
    return !currentAssigneeId || currentAssigneeId === actorId;
  }

  // Self-unassigning (clearing assignment if currently assigned to actor)
  if (!targetAssigneeId && currentAssigneeId === actorId) {
    return true;
  }

  return false;
}
