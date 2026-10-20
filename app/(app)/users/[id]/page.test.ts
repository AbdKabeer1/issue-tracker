import { beforeEach, describe, expect, it, vi } from "vitest";

const currentTenantIdFor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-context")>()),
  currentTenantIdFor,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(async () => ({ id: "viewer-1", role: "user" })),
}));

vi.mock("@/lib/points/leaderboard", () => ({
  pointTotals: vi.fn(async () => ({ points: 0, solvedTasks: 0 })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    bug: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import ProfilePage from "./page";

const person = {
  id: "reporter-1",
  name: "Ada",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(person as never);
  vi.mocked(prisma.bug.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.bug.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.bug.count).mockResolvedValue(0 as never);
});

describe("profile issues (#439)", () => {
  it("shows a new account with no membership no issues", async () => {
    currentTenantIdFor.mockResolvedValue(null);

    await ProfilePage({ params: Promise.resolve({ id: person.id }) });

    const wheres = [
      ...vi.mocked(prisma.bug.findMany).mock.calls.map((call) => call[0]?.where),
      ...vi.mocked(prisma.bug.groupBy).mock.calls.map((call) => call[0]?.where),
      ...vi.mocked(prisma.bug.count).mock.calls.map((call) => call[0]?.where),
    ];
    expect(wheres).toHaveLength(4);
    for (const where of wheres) {
      expect(where).toMatchObject({ tenantId: { in: [] }, isDeleted: false });
    }
  });

  it("limits a member to their own workspace", async () => {
    currentTenantIdFor.mockResolvedValue("tenant-zedu");

    await ProfilePage({ params: Promise.resolve({ id: person.id }) });

    expect(prisma.bug.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reporterId: person.id, tenantId: "tenant-zedu" }),
      }),
    );
  });
});
