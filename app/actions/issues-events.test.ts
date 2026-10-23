import { beforeEach, describe, expect, it, vi } from "vitest";

const publishWebEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/agent-api/web-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent-api/web-events")>()),
  publishWebEvent,
}));

vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-context")>()),
  currentTenantIdFor: vi.fn(async () => "tenant-zedu"),
  defaultProjectIdFor: vi.fn(async () => "project-zedu"),
  tenantIdForUser: vi.fn(async () => "tenant-zedu"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyLater: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", name: "Alice", role: "member" }),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: {
      create: vi.fn().mockResolvedValue({ id: "bug-123", title: "Something broke" }),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    category: {
      findFirst: vi.fn(),
    },
    issueType: {
      findUnique: vi.fn(),
    },
    attachment: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

import { createBugAction } from "./issues";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("issue creation agent events (#534)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes issue.created exactly once with the complete payload", async () => {
    const report = form({
      title: "Something broke in production",
      description: "Here are the details of the problem that happened.",
      proofLinks: "",
    });

    await createBugAction(report);

    expect(publishWebEvent).toHaveBeenCalledTimes(1);
    expect(publishWebEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bugId: "bug-123",
        type: "issue.created",
        actorUserId: "user-1",
        payload: {
          reporterId: "user-1",
          projectId: "project-zedu",
          beneficiaryUserId: "user-1",
          isReport: false,
        },
      }),
    );
  });

  it("publishes single issue.created event when filed as a report", async () => {
    const report = form({
      title: "Vulnerability found in auth endpoint",
      description: "Detailed description of the vulnerability report.",
      proofLinks: "",
      isReport: "true",
    });

    await createBugAction(report);

    expect(publishWebEvent).toHaveBeenCalledTimes(1);
    expect(publishWebEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bugId: "bug-123",
        type: "issue.created",
        actorUserId: "user-1",
        payload: {
          reporterId: "user-1",
          projectId: "project-zedu",
          beneficiaryUserId: "user-1",
          isReport: true,
        },
      }),
    );
  });

  it("does not fail issue creation if publishWebEvent throws", async () => {
    publishWebEvent.mockRejectedValueOnce(new Error("Event bus offline"));

    const report = form({
      title: "Another issue created",
      description: "Description that meets the minimum length requirement.",
      proofLinks: "",
    });

    // Should not throw or return an error object
    const result = await createBugAction(report);
    expect(result).toBeUndefined();
    expect(publishWebEvent).toHaveBeenCalledTimes(1);
  });
});
