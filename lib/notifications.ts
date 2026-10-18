import type { Status } from "@prisma/client";
import { commentPermalinkPath } from "@/lib/comment-window";
import { statusLabel } from "@/lib/labels";

/**
 * Notifications (#151, #216). Planning is pure (and unit-tested); delivery
 * lives in lib/notify.ts so server actions can hand it to `after()`. Each
 * planned notification is shown in the in-app feed and, if the person wants
 * email and SMTP is set up, emailed.
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
      /** Set for mentions in a comment, so the link jumps to it. */
      commentId?: string;
    })
  | (Base & {
      kind: "comment_added";
      commentId: string;
      excerpt?: string;
      /** Author of the comment being replied to, if any. */
      parentAuthorId?: string | null;
      /**
       * Everyone to tell: the issue's watchers (resolved at delivery from
       * reporter, assignee and watch rows, see lib/watch.ts).
       */
      recipientIds: string[];
      /** Already told by a "mentioned" notification for the same comment. */
      excludeIds?: string[];
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
      /** What happened, written by whoever resolved or closed it (#316). */
      note?: string | null;
      /** Watchers to tell, resolved at delivery; defaults to the reporter. */
      recipientIds?: string[];
    });

export type PlannedNotification = {
  userId: string;
  kind: NotificationEvent["kind"];
  /** Email subject. */
  subject: string;
  /** One-line summary for the in-app feed. */
  title: string;
  /** App-relative link for the in-app feed. */
  url: string;
  text: string;
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
  const commentId =
    event.kind === "comment_added" || event.kind === "mentioned" ? event.commentId : undefined;
  // The query lets the page load down to the comment's thread even when
  // it's older than the default window (#280).
  const path = commentId
    ? commentPermalinkPath(event.bugId, commentId)
    : `/issues/${event.bugId}`;
  const issueUrl = `${base}${path}`;
  const settingsUrl = `${base}/settings`;
  const title = quote(event.bugTitle);
  const planned: PlannedNotification[] = [];
  const add = (userId: string | null | undefined, subject: string, lines: (string | false | undefined)[]) => {
    if (!userId || userId === event.actorId) return;
    if (planned.some((p) => p.userId === userId)) return;
    planned.push({
      userId,
      kind: event.kind,
      subject: `[Zedu Issues] ${subject}`,
      title: subject,
      url: path,
      text: body(lines, issueUrl, settingsUrl),
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
    case "comment_added": {
      const skip = new Set(event.excludeIds ?? []);
      // Reply notice first, so the parent's author gets the more specific line.
      if (event.parentAuthorId && !skip.has(event.parentAuthorId)) {
        add(event.parentAuthorId, `${event.actorName} replied to your comment on ${title}`, [
          `${event.actorName} replied to your comment on ${title}.`,
          event.excerpt ? `\n> ${event.excerpt}` : undefined,
        ]);
      }
      for (const userId of event.recipientIds) {
        if (skip.has(userId)) continue;
        add(userId, `${event.actorName} commented on ${title}`, [
          `${event.actorName} commented on ${title}, which you're watching.`,
          event.excerpt ? `\n> ${event.excerpt}` : undefined,
        ]);
      }
      break;
    }
    case "status_changed":
      if (event.from === event.to) break;
      for (const userId of event.recipientIds ?? [event.reporterId]) {
        const yours = userId === event.reporterId;
        add(userId, `${title} is now ${statusLabel[event.to]}`, [
          `${event.actorName} changed the status of ${yours ? "your issue " : ""}${title} from ${statusLabel[event.from]} to ${statusLabel[event.to]}.`,
          ...(event.note ? ["", `Resolution note from ${event.actorName}:`, event.note] : []),
        ]);
      }
      break;
  }

  return planned;
}
