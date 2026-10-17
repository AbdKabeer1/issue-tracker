import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSendMail, sendMail } from "@/lib/mail";
import { getSiteUrl } from "@/lib/site-url";
import {
  planNotifications,
  type NotificationEvent,
  type PlannedNotification,
} from "@/lib/notifications";
import { shouldNotify } from "@/lib/notification-prefs";
import { watchersFor } from "@/lib/watch";
import { expireUnreadCounts } from "@/lib/lookups";

/**
 * Fills in the audience for events that go to an issue's watchers (#216):
 * new comments and status changes. Other events name their recipients.
 */
async function withWatchers(event: NotificationEvent): Promise<NotificationEvent> {
  if (event.kind === "comment_added") {
    return { ...event, recipientIds: await watchersFor(prisma, event.bugId, event.recipientIds) };
  }
  if (event.kind === "status_changed") {
    const bug = await prisma.bug.findUnique({
      where: { id: event.bugId },
      select: { assigneeId: true },
    });
    return {
      ...event,
      recipientIds: await watchersFor(prisma, event.bugId, [event.reporterId, bug?.assigneeId]),
    };
  }
  return event;
}

/** Writes the in-app feed rows (#216). Always, whatever the email settings. */
async function recordInApp(event: NotificationEvent, planned: PlannedNotification[]) {
  await prisma.notification.createMany({
    data: planned.map((n) => ({
      userId: n.userId,
      bugId: event.bugId,
      kind: n.kind,
      title: n.title,
      url: n.url,
    })),
  });
  // The recipients' header badges (#317).
  expireUnreadCounts(planned.map((n) => n.userId));
}

/** Emails everyone who hasn't opted out, when email can be sent at all (#210). */
async function sendEmails(planned: PlannedNotification[]) {
  if (!canSendMail()) return;
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
      if (!recipient || !shouldNotify(recipient, n.kind)) return;
      const to = recipient.email;
      try {
        await sendMail({ to, subject: n.subject, text: n.text });
      } catch (error) {
        console.error("[notify] failed to send", { userId: n.userId, error });
      }
    }),
  );
}

/** Deliver one event: in-app feed for everyone it concerns, plus email. */
export async function deliverNotifications(event: NotificationEvent): Promise<void> {
  // The issue may have been deleted between the action and delivery.
  const bug = await prisma.bug.findUnique({
    where: { id: event.bugId },
    select: { isDeleted: true },
  });
  if (!bug || bug.isDeleted) return;

  const planned = planNotifications(await withWatchers(event), getSiteUrl());
  if (planned.length === 0) return;

  try {
    await recordInApp(event, planned);
  } catch (error) {
    // The feed failing must not stop the emails.
    console.error("[notify] failed to record in-app notifications", error);
  }
  await sendEmails(planned);
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
