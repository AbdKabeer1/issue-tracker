import { describe, expect, it, vi, beforeEach } from "vitest";

// #600: these tests are about the actions themselves; the event is checked separately.
const publishWebEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/agent-api/web-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent-api/web-events")>()),
  publishWebEvent,
}));

// #425: run as a member of the Zedu tenant.
vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-context")>()),
  currentTenantIdFor: vi.fn(async () => "tenant-zedu"),
  defaultProjectIdFor: vi.fn(async () => "project-zedu"),
  tenantIdForUser: vi.fn(async () => "tenant-zedu"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "author-1", name: "Ada", role: "user" }),
}));

vi.mock("@/lib/notify", () => ({
  notifyLater: vi.fn(),
}));

const { txCommentUpdateMany, txAttachmentUpdateMany, txBugActivityUpdateMany } = vi.hoisted(() => ({
  txCommentUpdateMany: vi.fn(),
  txAttachmentUpdateMany: vi.fn(),
  txBugActivityUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    comment: { update: vi.fn(), updateMany: txCommentUpdateMany },
    bugActivity: { updateMany: txBugActivityUpdateMany },
    attachment: { deleteMany: vi.fn(), updateMany: txAttachmentUpdateMany },
  };
  return {
    prisma: {
      comment: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: vi.fn(),
      },
      membership: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { notifyLater } from "@/lib/notify";
import { COMMENT_ERRORS } from "@/lib/comment-permissions";
import { resetRateLimits } from "@/lib/rate-limit";
import { deleteCommentAction, updateCommentAction } from "./comments";

const findCommentMock = vi.mocked(prisma.comment.findUnique) as unknown as ReturnType<typeof vi.fn>;
const findUsersMock = vi.mocked(prisma.user.findMany) as unknown as ReturnType<typeof vi.fn>;
const notifyMock = vi.mocked(notifyLater);

const bobId = "clxxxxxxxxxxxxxxxxxxxxxxxx2";
const carolId = "clxxxxxxxxxxxxxxxxxxxxxxxx3";

function existingComment(body: string) {
  return {
    id: "comment-1",
    bugId: "bug-1",
    authorId: "author-1",
    body,
    deletedAt: null,
    author: { name: "Ada" },
    bug: { isDeleted: false, title: "Login button does nothing" },
  };
}

function edit(body: string) {
  const formData = new FormData();
  formData.set("body", body);
  return updateCommentAction("comment-1", formData);
}

describe("updateCommentAction mention notifications (#228)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    txCommentUpdateMany.mockResolvedValue({ count: 1 });
    txAttachmentUpdateMany.mockResolvedValue({ count: 0 });
    findUsersMock.mockResolvedValue([
      { id: bobId, name: "Bob" },
      { id: carolId, name: "Carol" },
    ]);
  });

  it("notifies a person newly tagged by the edit", async () => {
    findCommentMock.mockResolvedValue(existingComment("Can someone check this?"));

    const result = await edit(`Can someone check this? @[Bob](${bobId})`);

    expect(result).toEqual({ ok: true });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "mentioned",
        place: "comment",
        commentId: "comment-1",
        actorId: "author-1",
        bugId: "bug-1",
        bugTitle: "Login button does nothing",
        recipientIds: [bobId],
      }),
    );
  });

  it("includes commentId when notifying about new mentions in an edited comment (#720)", async () => {
    findCommentMock.mockResolvedValue(existingComment("Initial comment without mentions"));

    await edit(`Initial comment without mentions @[Carol](${carolId})`);

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "mentioned",
        place: "comment",
        commentId: "comment-1",
        recipientIds: [carolId],
      }),
    );
  });

  it("only notifies the new person, not people already tagged", async () => {
    findCommentMock.mockResolvedValue(existingComment(`cc @[Bob](${bobId})`));

    await edit(`cc @[Bob](${bobId}) @[Carol](${carolId})`);

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: [carolId] }),
    );
  });

  it("sends nothing when the edit adds no new mentions", async () => {
    findCommentMock.mockResolvedValue(existingComment(`cc @[Bob](${bobId})`));

    await edit(`cc @[Bob](${bobId}), fixed a typo`);

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("enforces rate limit when editing comments rapidly (#350)", async () => {
    const { resetRateLimits, ACTION_RATE_LIMITS, RATE_LIMIT_MESSAGE } = await import("@/lib/rate-limit");
    resetRateLimits();
    findCommentMock.mockResolvedValue(existingComment("Initial comment"));

    for (let i = 0; i < ACTION_RATE_LIMITS.editComment.max; i++) {
      const res = await edit(`Edit iteration ${i}`);
      expect(res).toEqual({ ok: true });
    }

    const blocked = await edit("One edit too many");
    expect(blocked).toEqual({ error: RATE_LIMIT_MESSAGE });
  });

  it("uses shared persistent store for rate limiting when configured (#624)", async () => {
    const { setRateLimitStore, ACTION_RATE_LIMITS, RATE_LIMIT_MESSAGE } = await import("@/lib/rate-limit");
    const hitMock = vi.fn().mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    setRateLimitStore({ hit: hitMock });
    findCommentMock.mockResolvedValue(existingComment("Initial comment"));

    try {
      const blocked = await edit("Edit with custom store");
      expect(blocked).toEqual({ error: RATE_LIMIT_MESSAGE });
      expect(hitMock).toHaveBeenCalledWith(
        "edit-comment:author-1",
        ACTION_RATE_LIMITS.editComment,
        expect.any(Number),
      );
    } finally {
      setRateLimitStore(null);
    }
  });

  it("fails with deleted error and avoids side effects when comment was deleted concurrently (#721)", async () => {
    findCommentMock.mockResolvedValue(existingComment("Initial comment"));
    txCommentUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await edit("New body text that raced deletion ![screenshot](/api/attachments/att-1)");
    expect(res).toEqual({ error: COMMENT_ERRORS.deleted });
    expect(notifyMock).not.toHaveBeenCalled();
    expect(txBugActivityUpdateMany).not.toHaveBeenCalled();
    expect(txAttachmentUpdateMany).not.toHaveBeenCalled();
  });

  it("fails deleteCommentAction with deleted error when comment was deleted concurrently (#721)", async () => {
    findCommentMock.mockResolvedValue(existingComment("Initial comment"));
    txCommentUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await deleteCommentAction("comment-1");
    expect(res).toEqual({ error: COMMENT_ERRORS.deleted });
    expect(txBugActivityUpdateMany).not.toHaveBeenCalled();
  });
});

describe("agents hear about comment edits (#600)", () => {
  it("publishes comment.edited for the edited comment", async () => {
    vi.clearAllMocks();
    (await import("@/lib/rate-limit")).resetRateLimits();
    findUsersMock.mockResolvedValue([]);
    findCommentMock.mockResolvedValue(existingComment("first draft"));

    expect(await edit("second draft")).toEqual({ ok: true });
    expect(publishWebEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bugId: "bug-1", type: "comment.edited", actorUserId: "author-1" }),
    );
  });
});
