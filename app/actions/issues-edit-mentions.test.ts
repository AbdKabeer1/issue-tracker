import { describe, expect, it, vi, beforeEach } from "vitest";

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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "reporter-1", name: "Ada", role: "user" }),
}));
vi.mock("@/lib/tenant-access", () => ({
  currentTenantAccess: vi.fn(async () => ({
    tenantId: "tenant-zedu",
    tenantName: "Zedu",
    tenantSlug: "zedu",
    membershipRole: "member",
    admin: false,
  })),
}));

vi.mock("@/lib/session-user", () => ({
  resolveSessionUserId: vi.fn(),
  SESSION_EXPIRED_MESSAGE: "Session expired, sign in again",
}));

vi.mock("@/lib/notify", () => ({
  notifyLater: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    bug: { update: vi.fn() },
    bugActivity: { create: vi.fn() },
    bugRevision: { create: vi.fn() },
    $queryRaw: vi.fn(async () => []),
  };
  return {
    prisma: {
      bug: { findUnique: vi.fn() },
      user: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { notifyLater } from "@/lib/notify";
import { editBugContentAction } from "./issues";

const findBugMock = vi.mocked(prisma.bug.findUnique) as unknown as ReturnType<typeof vi.fn>;
const findUsersMock = vi.mocked(prisma.user.findMany) as unknown as ReturnType<typeof vi.fn>;
const notifyMock = vi.mocked(notifyLater);

const bobId = "clxxxxxxxxxxxxxxxxxxxxxxxx2";
const carolId = "clxxxxxxxxxxxxxxxxxxxxxxxx3";

function existingBug(description: string) {
  return {
    id: "bug-1",
    title: "Login button does nothing",
    description,
    reporterId: "reporter-1",
    isDeleted: false,
  };
}

function edit(description: string) {
  const formData = new FormData();
  formData.set("title", "Login button does nothing");
  formData.set("description", description);
  return editBugContentAction("bug-1", formData);
}

describe("editBugContentAction mention notifications (#228)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUsersMock.mockResolvedValue([
      { id: bobId, name: "Bob" },
      { id: carolId, name: "Carol" },
    ]);
  });

  it("notifies a person newly tagged in the description", async () => {
    findBugMock.mockResolvedValue(existingBug("Clicking Login does nothing at all."));

    const result = await edit(`Clicking Login does nothing at all. cc @[Bob](${bobId})`);

    expect(result).toEqual({ ok: true });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "mentioned",
        place: "description",
        actorId: "reporter-1",
        bugId: "bug-1",
        recipientIds: [bobId],
      }),
    );
  });

  it("only notifies the new person, not people already tagged", async () => {
    findBugMock.mockResolvedValue(existingBug(`Clicking Login does nothing. cc @[Bob](${bobId})`));

    await edit(`Clicking Login does nothing. cc @[Bob](${bobId}) @[Carol](${carolId})`);

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: [carolId] }),
    );
  });

  it("sends nothing when the edit adds no new mentions", async () => {
    findBugMock.mockResolvedValue(existingBug(`Clicking Login does nothing. cc @[Bob](${bobId})`));

    await edit(`Clicking Login does nothing on Chrome. cc @[Bob](${bobId})`);

    expect(notifyMock).not.toHaveBeenCalled();
  });
});

describe("editBugContentAction history (#303)", () => {
  type TxMock = {
    bugRevision: { create: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let tx: TxMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    findUsersMock.mockResolvedValue([]);
    const txMock = vi.mocked(prisma.$transaction) as unknown as ReturnType<typeof vi.fn>;
    txMock.mockImplementationOnce(async (fn: (client: unknown) => unknown) => {
      const inner = {
        bug: { update: vi.fn() },
        bugActivity: { create: vi.fn() },
        bugRevision: { create: vi.fn() },
        $queryRaw: vi.fn(async () => [{ title: "Locked title", description: "Locked text" }]),
      };
      tx = inner;
      return fn(inner);
    });
  });

  it("stores the version the edit replaced, read under the row lock", async () => {
    findBugMock.mockResolvedValue(existingBug("Clicking Login does nothing at all."));
    await edit("Clicking Login does nothing at all on Safari.");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.bugRevision.create).toHaveBeenCalledWith({
      data: { bugId: "bug-1", title: "Locked title", description: "Locked text", editedById: "reporter-1" },
    });
  });

  it("stores nothing when nothing changed", async () => {
    findBugMock.mockResolvedValue(existingBug("Clicking Login does nothing at all."));
    await edit("Clicking Login does nothing at all.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
