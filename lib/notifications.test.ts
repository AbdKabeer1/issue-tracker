import { describe, expect, it } from "vitest";
import { planNotifications, type NotificationEvent } from "./notifications";

const SITE = "https://issues.zedu.chat";
const base = { actorId: "alice", actorName: "Alice", bugId: "b1", bugTitle: "Login button does nothing" };

describe("planNotifications (#151)", () => {
  it("emails each mentioned user once, never the author", () => {
    const event: NotificationEvent = {
      ...base,
      kind: "mentioned",
      place: "comment",
      recipientIds: ["bob", "alice", "bob", "cara"],
      excerpt: "@Bob can you check?",
    };
    const planned = planNotifications(event, SITE);
    expect(planned.map((p) => p.userId)).toEqual(["bob", "cara"]);
    expect(planned[0]?.subject).toBe("[Zedu Issues] Alice mentioned you on “Login button does nothing”");
    expect(planned[0]?.text).toContain("mentioned you in a comment on");
    expect(planned[0]?.text).toContain("> @Bob can you check?");
    expect(planned[0]?.text).toContain("https://issues.zedu.chat/bugs/b1");
    expect(planned[0]?.text).toContain("https://issues.zedu.chat/settings");
  });

  it("tells the new and the previous assignee", () => {
    const planned = planNotifications(
      { ...base, kind: "assignee_changed", fromUserId: "cara", toUserId: "bob" },
      SITE,
    );
    expect(planned.map((p) => p.userId)).toEqual(["bob", "cara"]);
    expect(planned[0]?.text).toContain("assigned “Login button does nothing” to you");
    expect(planned[1]?.text).toContain("no longer assigned to you");
  });

  it("explains a take-over to the previous assignee", () => {
    const planned = planNotifications(
      { ...base, kind: "assignee_changed", fromUserId: "cara", toUserId: "alice" },
      SITE,
    );
    expect(planned.map((p) => p.userId)).toEqual(["cara"]);
    expect(planned[0]?.text).toContain("Alice took over");
  });

  it("tells someone they were unassigned", () => {
    const planned = planNotifications(
      { ...base, kind: "assignee_changed", fromUserId: "cara", toUserId: null },
      SITE,
    );
    expect(planned[0]?.text).toContain("unassigned you from");
  });

  it("doesn't notify when the assignee didn't change or you assign yourself", () => {
    expect(planNotifications({ ...base, kind: "assignee_changed", fromUserId: "bob", toUserId: "bob" }, SITE)).toEqual([]);
    expect(planNotifications({ ...base, kind: "assignee_changed", fromUserId: null, toUserId: "alice" }, SITE)).toEqual([]);
  });

  it("tells the reporter about status changes, except their own", () => {
    const planned = planNotifications(
      { ...base, kind: "status_changed", reporterId: "bob", from: "open", to: "resolved" },
      SITE,
    );
    expect(planned).toHaveLength(1);
    expect(planned[0]?.subject).toBe("[Zedu Issues] “Login button does nothing” is now Resolved");
    expect(planned[0]?.text).toContain("from Open to Resolved");
    expect(
      planNotifications({ ...base, kind: "status_changed", reporterId: "alice", from: "open", to: "closed" }, SITE),
    ).toEqual([]);
  });

  it("truncates long titles in subjects", () => {
    const planned = planNotifications(
      { ...base, bugTitle: "x".repeat(120), kind: "status_changed", reporterId: "bob", from: "open", to: "closed" },
      SITE,
    );
    expect(planned[0]?.subject.length).toBeLessThan(120);
    expect(planned[0]?.subject).toContain("…");
  });
});
