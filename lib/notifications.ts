import type { Status } from "@prisma/client";
import { statusLabel } from "@/lib/labels";

/**
 * Email notifications (#151). Planning is pure (and unit-tested); delivery
 * lives in lib/notify.ts so server actions can hand it to `after()`.
 *
 * Rules: nobody is told about their own action, each person gets at most one
 * email per event, and deleted issues never notify (the actions that raise
 * these events already refuse to act on them).
 */

type Base = { actorId: string; actorName: string; bugId: string; bugTitle: string };

export type NotificationEvent =
  | (Base & {
      kind: "mentioned";
      recipientIds: string[];
      /** Where the mention was written. */
      place: "description" | "comment";
      excerpt?: string;
    })
  | (Base & {
      kind: "assignee_changed";
      fromUserId: string | null;
      toUserId: string | null;
    })
  | (Base & {
      kind: "status_changed";
      reporterId: string;
      from: Status;
      to: Status;
    });

export type PlannedNotification = {
  userId: string;
  subject: string;
  text: string;
  /** Which event produced it, so delivery can honour per-kind preferences. */
  kind: NotificationEvent["kind"];
};

const quote = (title: string) => `“${title.length > 80 ? `${title.slice(0, 79)}…` : title}”`;

function body(lines: (string | false | undefined)[], issueUrl: string, settingsUrl: string) {
  return [
    ...lines.filter((line): line is string => typeof line === "string"),
    "",
    `Open the issue: ${issueUrl}`,
    "",
    `You can turn these emails off in Settings: ${settingsUrl}`,
  ].join("\n");
}

export function planNotifications(event: NotificationEvent, siteUrl: string): PlannedNotification[] {
  const base = siteUrl.replace(/\/$/, "");
  const issueUrl = `${base}/bugs/${event.bugId}`;
  const settingsUrl = `${base}/settings`;
  const title = quote(event.bugTitle);
  const planned: PlannedNotification[] = [];
  const add = (userId: string | null | undefined, subject: string, lines: (string | false | undefined)[]) => {
    if (!userId || userId === event.actorId) return;
    if (planned.some((p) => p.userId === userId)) return;
    planned.push({
      userId,
      subject: `[Zedu Issues] ${subject}`,
      text: body(lines, issueUrl, settingsUrl),
      kind: event.kind,
    });
  };

  switch (event.kind) {
    case "mentioned":
      for (const userId of event.recipientIds) {
        add(userId, `${event.actorName} mentioned you on ${title}`, [
          `${event.actorName} mentioned you in ${event.place === "comment" ? "a comment on" : "the description of"} ${title}.`,
          event.excerpt ? `\n> ${event.excerpt}` : undefined,
        ]);
      }
      break;
    case "assignee_changed":
      if (event.fromUserId === event.toUserId) break;
      add(event.toUserId, `${event.actorName} assigned you to ${title}`, [
        `${event.actorName} assigned ${title} to you.`,
      ]);
      add(event.fromUserId, `${event.actorName} reassigned ${title}`, [
        event.toUserId === event.actorId
          ? `${event.actorName} took over ${title}, which was assigned to you.`
          : event.toUserId
            ? `${event.actorName} reassigned ${title}. It's no longer assigned to you.`
            : `${event.actorName} unassigned you from ${title}.`,
      ]);
      break;
    case "status_changed":
      if (event.from === event.to) break;
      add(event.reporterId, `${title} is now ${statusLabel[event.to]}`, [
        `${event.actorName} changed the status of your issue ${title} from ${statusLabel[event.from]} to ${statusLabel[event.to]}.`,
      ]);
      break;
  }

  return planned;
}
