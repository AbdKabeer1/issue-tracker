import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const pageSource = readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf8",
);

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/session-user", () => ({
  resolveSessionUserId: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/roles", () => ({
  isAdmin: vi.fn((role) => role === "admin" || role === "super_admin"),
}));

vi.mock("@/lib/ticket-deletion", () => ({
  canDeleteTicket: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ticket-editing", () => ({
  canEditTicket: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ticket-assignment", () => ({
  canAssignTicket: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/voter-summaries", () => ({
  fetchVoterSummary: vi.fn().mockResolvedValue({
    likes: { count: 0, preview: [] },
    dislikes: { count: 0, preview: [] },
  }),
}));

vi.mock("@/lib/issue-types", () => ({
  getActiveIssueTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    bugActivity: { count: vi.fn().mockResolvedValue(0) },
    issueWatch: { findUnique: vi.fn().mockResolvedValue(null) },
    attachment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { resolveSessionUserId } from "@/lib/session-user";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import BugDetailPage from "./page";

const mockResolveSessionUserId = vi.mocked(resolveSessionUserId);
const mockRequireUser = vi.mocked(requireUser);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockBugFindUnique = vi.mocked(prisma.bug.findUnique);

describe("BugDetailPage conditional user query (#349)", () => {
  it("guards prisma.user.findMany behind canTriage in source code", () => {
    // Assert structural invariant: user query must be conditionally executed
    expect(pageSource).toMatch(/canTriage\s*\?\s*prisma\.user\.findMany/);
  });

  describe("runtime execution", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResolveSessionUserId.mockResolvedValue({ userId: "user-123" });
      mockBugFindUnique.mockResolvedValue({
        id: "bug-1",
        number: 42,
        title: "Test Bug",
        description: "Test Description",
        status: "open",
        severity: "medium",
        voteCount: 0,
        proofLinks: [],
        reporterId: "reporter-1",
        assigneeId: null,
        type: null,
        reporter: { name: "Reporter", email: "rep@zedu.dev", role: "user" },
        assignee: null,
        category: null,
        comments: [],
        activities: [],
        votes: [],
        isDeleted: false,
      } as unknown as Awaited<ReturnType<typeof prisma.bug.findUnique>>);
    });

    it("does not query database users when viewer is a non-admin user", async () => {
      mockRequireUser.mockResolvedValue({
        id: "user-123",
        role: "user",
      } as unknown as Awaited<ReturnType<typeof requireUser>>);

      await BugDetailPage({
        params: Promise.resolve({ id: "bug-1" }),
      });

      expect(mockUserFindMany).not.toHaveBeenCalled();
    });

    it("queries database users when viewer is an admin", async () => {
      mockRequireUser.mockResolvedValue({
        id: "admin-123",
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireUser>>);
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", name: "Alice", role: "admin" },
      ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

      await BugDetailPage({
        params: Promise.resolve({ id: "bug-1" }),
      });

      expect(mockUserFindMany).toHaveBeenCalledTimes(1);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      });
    });

    it("queries database users when viewer is a super admin", async () => {
      mockRequireUser.mockResolvedValue({
        id: "super-123",
        role: "super_admin",
      } as unknown as Awaited<ReturnType<typeof requireUser>>);
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", name: "Alice", role: "admin" },
      ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

      await BugDetailPage({
        params: Promise.resolve({ id: "bug-1" }),
      });

      expect(mockUserFindMany).toHaveBeenCalledTimes(1);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      });
    });
  });
});
