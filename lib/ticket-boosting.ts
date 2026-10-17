import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_BOOST_ERRORS = {
  unauthorized: "Only admins can boost issues",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  failed: "Could not update issue boost status. Please try again.",
} as const;

export type TicketBoostError = keyof typeof TICKET_BOOST_ERRORS;

/**
 * Checks whether a user with the given role has permission to boost or unboost tickets.
 * Admins and super admins are permitted.
 */
export function canBoostTicket(role?: AppRole | null): boolean {
  return isAdmin(role);
}

/** Statuses that mean the work is done, so a boost no longer applies. */
const FINISHED_STATUSES: readonly string[] = ["resolved", "closed"];

/**
 * Whether a status change should clear an issue's boost (#256): boosting
 * pins open work to the top, so it is dropped once the issue is resolved
 * or closed. Reopening does not re-boost.
 */
export function shouldUnboostOnStatusChange({
  isBoosted,
  from,
  to,
}: {
  isBoosted: boolean;
  from: string;
  to: string | undefined;
}): boolean {
  return Boolean(isBoosted && to && to !== from && FINISHED_STATUSES.includes(to));
}
