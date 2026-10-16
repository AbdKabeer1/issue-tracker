import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_DELETION_ERRORS = {
  unauthorized: "Only admins and super admins can delete tickets",
  unauthorizedRestore: "Only admins and super admins can restore tickets",
  invalidId: "Invalid ticket ID",
  notFound: "Ticket not found",
  alreadyDeleted: "Ticket is already deleted",
  notDeleted: "Ticket is not deleted",
  failed: "Could not delete ticket. Please try again.",
  failedRestore: "Could not restore ticket. Please try again.",
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
