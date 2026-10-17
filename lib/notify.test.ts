import { beforeEach, describe, expect, it, vi } from "vitest";

/** Opt-out filtering, per-recipient isolation and dedupe in notifications (#218). */

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(), canSendMail: vi.fn(() => true) }));
// bug / notification / issueWatch are used once notifications also have an
// in-app feed and watchers (#216); harmless before that.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    bug: { findUnique: vi.fn(async () => ({ isDeleted: false, assigneeId: null })) },
    notification: { createMany: vi.fn() },
    issueWatch: { findMany: vi.fn(async () => []) },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { deliverNotifications } from "./notify";

const findMany = prisma.user.findMany as unknown as ReturnType<typeof vi.fn>;
const send = sendMail as unknown as ReturnType<typeof vi.fn>;

const base = { actorId: "actor", actorName: "Alice", bugId: "b1", bugTitle: "Broken button" };

/** A recipient who wants every kind of mail, unless told otherwise. */
const who = (id: string, over: Record<string, boolean> = {}) => ({
  id,
  email: `${id}@x.dev`,
  emailNotifications: true,
  notifyMentions: true,
  notifyAssignments: true,
  notifyStatusChanges: true,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("deliverNotifications", () => {
  it("only emails people who haven't opted out", async () => {
    findMany.mockResolvedValue([who("bob")]);
    await deliverNotifications({ ...base, kind: "mentioned", recipientIds: ["bob", "cara"], place: "comment" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ emailNotifications: true }) }),
    );
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].to).toBe("bob@x.dev");
  });

  it("keeps sending to others when one recipient fails", async () => {
    findMany.mockResolvedValue([who("bob"), who("cara")]);
    send.mockRejectedValueOnce(new Error("SMTP 550")).mockResolvedValueOnce(undefined);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      deliverNotifications({ ...base, kind: "mentioned", recipientIds: ["bob", "cara"], place: "comment" }),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("skips a recipient who switched off that kind of email", async () => {
    findMany.mockResolvedValue([
      who("bob", { notifyMentions: false }),
      who("cara"),
    ]);
    await deliverNotifications({ ...base, kind: "mentioned", recipientIds: ["bob", "cara"], place: "comment" });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].to).toBe("cara@x.dev");
  });

  it("still sends the kinds that recipient kept", async () => {
    findMany.mockResolvedValue([who("bob", { notifyMentions: false })]);
    await deliverNotifications({
      ...base,
      kind: "assignee_changed",
      fromUserId: null,
      toUserId: "bob",
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].to).toBe("bob@x.dev");
  });

  it("never emails the person who acted, and skips the query when nobody's left", async () => {
    await deliverNotifications({ ...base, kind: "mentioned", recipientIds: ["actor"], place: "comment" });
    expect(findMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
