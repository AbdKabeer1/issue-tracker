import type { MembershipRole } from "@prisma/client";
import { isOrganizationAdmin } from "@/lib/organization-role";
import type { AppRole } from "@/lib/roles";

export const TICKET_DELETION_ERRORS = {
  unauthorized: "Only an owner or admin of this organization can delete issues",
  unauthorizedRestore: "Only an owner or admin of this organization can restore issues",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  alreadyDeleted: "Issue is already deleted",
  notDeleted: "Issue is not deleted",
  failed: "Could not delete issue. Please try again.",
  failedRestore: "Could not restore issue. Please try again.",
} as const;

export type TicketDeletionError = keyof typeof TICKET_DELETION_ERRORS;

/**
 * Soft-delete is an organization power: owner, admin, or the site super admin.
 * A site-wide admin who is only a member cannot delete here.
 */
export function canDeleteTicket(
  role?: AppRole | null,
  membershipRole?: MembershipRole | null,
): boolean {
  return isOrganizationAdmin(membershipRole, role);
}

/** Same people who can delete can restore. */
export function canRestoreTicket(
  role?: AppRole | null,
  membershipRole?: MembershipRole | null,
): boolean {
  return isOrganizationAdmin(membershipRole, role);
}
