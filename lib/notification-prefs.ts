import type { NotificationEvent } from "@/lib/notifications";

/** The kinds of email a user can be sent, and can switch off one at a time. */
export const NOTIFICATION_KINDS = [
  "mentioned",
  "assignee_changed",
  "status_changed",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The User column holding the preference for each kind. */
export const PREF_FIELD = {
  mentioned: "notifyMentions",
  assignee_changed: "notifyAssignments",
  status_changed: "notifyStatusChanges",
} as const satisfies Record<NotificationKind, string>;

export type PrefField = (typeof PREF_FIELD)[NotificationKind];

export const notificationLabels: Record<NotificationKind, string> = {
  mentioned: "Mentions",
  assignee_changed: "Assignments",
  status_changed: "Status changes",
};

export const notificationDescriptions: Record<NotificationKind, string> = {
  mentioned: "When someone @mentions you in an issue or a comment.",
  assignee_changed: "When an issue is assigned to you, or taken from you.",
  status_changed: "When the status changes on an issue you reported.",
};

/** The preferences a recipient carries, as far as this module cares. */
export type RecipientPrefs = {
  emailNotifications: boolean;
  notifyMentions: boolean;
  notifyAssignments: boolean;
  notifyStatusChanges: boolean;
};

/**
 * Whether this recipient should receive mail for this kind of event.
 *
 * `emailNotifications` is a master switch: off means no mail at all, whatever
 * the per-kind flags say. That keeps "turn everything off" a single click,
 * and keeps it reversible without losing the finer choices underneath.
 */
export function shouldNotify(
  prefs: RecipientPrefs,
  kind: NotificationEvent["kind"],
): boolean {
  if (!prefs.emailNotifications) return false;
  if (kind === "comment_added") return true;
  return prefs[PREF_FIELD[kind]];
}

/** True when the value names a preference a user is allowed to set. */
export function isNotificationKind(value: unknown): value is NotificationKind {
  return (
    typeof value === "string" &&
    (NOTIFICATION_KINDS as readonly string[]).includes(value)
  );
}
