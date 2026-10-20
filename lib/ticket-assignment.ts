import type { MembershipRole } from "@prisma/client";
import { isOrganizationAdmin } from "@/lib/organization-role";
import type { AppRole } from "@/lib/roles";

export const TICKET_ASSIGN_ERRORS = {
  unauthorized: "Only an owner or admin of this organization can assign issues to other people",
  unauthorizedUpdate: "Only the assignee, or an owner or admin of this organization, can update this issue",
  statusNeedsAssignment: "Assign this issue to yourself first, then change its status.",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  assigneeNotFound: "Assignee not found",
  failed: "Could not update issue assignment. Please try again.",
} as const;

export type TicketAssignError = keyof typeof TICKET_ASSIGN_ERRORS;

/**
 * Checks whether an actor can assign an issue to a given target assignee.
 * - Owners, admins, and the site super admin can assign to any user, or unassign (targetAssigneeId = null).
 *   A site-wide admin who is only a member cannot.
 * - Normal users can assign to themselves (targetAssigneeId = actorId),
 *   provided the ticket is unassigned or already assigned to them.
 * - Normal users can unassign themselves if they are the current assignee (targetAssigneeId = null && currentAssigneeId = actorId).
 * - Normal users cannot assign to any other user or take over another user's assignment.
 */
export function canAssignTicket({
  actorId,
  actorRole,
  membershipRole,
  currentAssigneeId,
  targetAssigneeId,
}: {
  actorId: string;
  actorRole?: AppRole | null;
  membershipRole?: MembershipRole | null;
  currentAssigneeId?: string | null;
  targetAssigneeId?: string | null;
}): boolean {
  if (isOrganizationAdmin(membershipRole, actorRole)) {
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
