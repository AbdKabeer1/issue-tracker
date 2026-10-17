import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSendMail, sendMail } from "@/lib/mail";
import { getSiteUrl } from "@/lib/site-url";
import { planNotifications, type NotificationEvent } from "@/lib/notifications";
import { shouldNotify, type RecipientPrefs } from "@/lib/notification-prefs";

/** Send the emails for one event to everyone who hasn't opted out. */
export async function deliverNotifications(event: NotificationEvent): Promise<void> {
  // No SMTP in production: skip quietly rather than fail once per recipient (#210).
  if (!canSendMail()) return;
  const planned = planNotifications(event, getSiteUrl());
  if (planned.length === 0) return;

  // Fetch the preferences rather than filtering in the query: which flag
  // matters depends on the kind of each planned notification, and one event
  // can produce several kinds across different recipients.
  const recipients = await prisma.user.findMany({
    where: { id: { in: planned.map((p) => p.userId) }, emailNotifications: true },
    select: {
      id: true,
      email: true,
      emailNotifications: true,
      notifyMentions: true,
      notifyAssignments: true,
      notifyStatusChanges: true,
    },
  });
  const byId = new Map(recipients.map((u) => [u.id, u]));

  await Promise.all(
    planned.map(async (n) => {
      const recipient = byId.get(n.userId);
      if (!recipient || !shouldNotify(recipient as RecipientPrefs, n.kind)) return;
      const to = recipient.email;
      try {
        await sendMail({ to, subject: n.subject, text: n.text });
      } catch (error) {
        console.error("[notify] failed to send", { userId: n.userId, error });
      }
    }),
  );
}

/**
 * Queue notifications to go out after the response, so a slow or failing
 * mail server never delays or breaks the action that triggered them.
 */
export function notifyLater(...events: NotificationEvent[]): void {
  after(async () => {
    for (const event of events) {
      try {
        await deliverNotifications(event);
      } catch (error) {
        console.error("[notify] delivery failed", error);
      }
    }
  });
}
