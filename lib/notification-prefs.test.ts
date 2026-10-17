import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_KINDS,
  PREF_FIELD,
  isNotificationKind,
  notificationDescriptions,
  notificationLabels,
  shouldNotify,
  type NotificationKind,
  type RecipientPrefs,
} from "./notification-prefs";

const prefs = (over: Partial<RecipientPrefs> = {}): RecipientPrefs => ({
  emailNotifications: true,
  notifyMentions: true,
  notifyAssignments: true,
  notifyStatusChanges: true,
  ...over,
});

describe("shouldNotify", () => {
  it("sends when the master switch and the kind are both on", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(shouldNotify(prefs(), kind), kind).toBe(true);
    }
  });

  it("sends nothing at all when the master switch is off", () => {
    const off = prefs({ emailNotifications: false });
    for (const kind of NOTIFICATION_KINDS) {
      expect(shouldNotify(off, kind), kind).toBe(false);
    }
  });

  it("drops only the kind that was switched off", () => {
    const noStatus = prefs({ notifyStatusChanges: false });
    expect(shouldNotify(noStatus, "status_changed")).toBe(false);
    expect(shouldNotify(noStatus, "mentioned")).toBe(true);
    expect(shouldNotify(noStatus, "assignee_changed")).toBe(true);
  });

  it("keeps the per-kind choices while the master switch is off", () => {
    // Turning the master switch back on must restore what was selected, not
    // resubscribe to everything.
    const paused = prefs({ emailNotifications: false, notifyMentions: false });
    expect(shouldNotify(paused, "mentioned")).toBe(false);
    expect(shouldNotify({ ...paused, emailNotifications: true }, "mentioned")).toBe(false);
    expect(shouldNotify({ ...paused, emailNotifications: true }, "assignee_changed")).toBe(true);
  });
});

describe("the preference table", () => {
  it("covers every kind, with a distinct column each", () => {
    const fields = NOTIFICATION_KINDS.map((k) => PREF_FIELD[k]);
    expect(new Set(fields).size).toBe(NOTIFICATION_KINDS.length);
  });

  it("has a label and a description for every kind", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(notificationLabels[kind], kind).toBeTruthy();
      expect(notificationDescriptions[kind], kind).toBeTruthy();
    }
  });

  it("names columns that exist on User in the schema", () => {
    // The action writes `data: { [PREF_FIELD[kind]]: enabled }`, so a typo
    // here would only surface at runtime.
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const user = schema.slice(schema.indexOf("model User {"));
    for (const kind of NOTIFICATION_KINDS) {
      expect(user, kind).toContain(PREF_FIELD[kind]);
    }
  });
});

describe("isNotificationKind", () => {
  it("accepts the real kinds", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(isNotificationKind(kind), kind).toBe(true);
    }
  });

  it("rejects anything else, so a column name cannot come from the request", () => {
    const hostile: unknown[] = [
      "notifyMentions",
      "role",
      "passwordHash",
      "__proto__",
      "",
      null,
      undefined,
      42,
      { kind: "mentioned" },
    ];
    for (const value of hostile) {
      expect(isNotificationKind(value), String(value)).toBe(false);
    }
  });

  it("narrows to NotificationKind", () => {
    const value: unknown = "mentioned";
    if (isNotificationKind(value)) {
      const kind: NotificationKind = value;
      expect(PREF_FIELD[kind]).toBe("notifyMentions");
    }
  });
});
