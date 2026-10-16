import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_DELETION_ERRORS = {
  unauthorized: "Only admins and super admins can delete issues",
  unauthorizedRestore: "Only admins and super admins can restore issues",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  alreadyDeleted: "Issue is already deleted",
  notDeleted: "Issue is not deleted",
  failed: "Could not delete issue. Please try again.",
  failedRestore: "Could not restore issue. Please try again.",
} as const;

export type TicketDeletionError = keyof typeof TICKET_DELETION_ERRORS;

/**
 * Checks whether a user with the given role has permission to soft-delete tickets.
 * Admins and super admins are permitted.
 */
export function canDeleteTicket(role?: AppRole | null): boolean {
  return isAdmin(role);
}

/**
 * Checks whether a user with the given role has permission to restore soft-deleted tickets.
 * Admins and super admins are permitted.
 */
export function canRestoreTicket(role?: AppRole | null): boolean {
  return isAdmin(role);
}
