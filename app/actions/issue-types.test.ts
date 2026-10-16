import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    issueType: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createIssueTypeAction, updateIssueTypeAction } from "./issue-types";

const findFirstMock = vi.mocked(prisma.issueType.findFirst) as unknown as ReturnType<typeof vi.fn>;
const createMock = vi.mocked(prisma.issueType.create) as unknown as ReturnType<typeof vi.fn>;
const updateMock = vi.mocked(prisma.issueType.update) as unknown as ReturnType<typeof vi.fn>;

describe("issue-types actions duplicate checks (#139)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createIssueTypeAction", () => {
    it("rejects case-insensitive duplicate type names", async () => {
      findFirstMock.mockResolvedValue({ id: "type-1", name: "Fix" });

      const formData = new FormData();
      formData.set("name", "fix ");

      const result = await createIssueTypeAction(formData);

      expect(result.error).toBe('A type named "Fix" already exists.');
      expect(findFirstMock).toHaveBeenCalledWith({
        where: {
          name: {
            equals: "fix",
            mode: "insensitive",
          },
        },
      });
      expect(createMock).not.toHaveBeenCalled();
    });

    it("creates type when name is unique", async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue({ id: "type-2", name: "Feat", isActive: true });

      const formData = new FormData();
      formData.set("name", "  Feat  ");

      const result = await createIssueTypeAction(formData);

      expect(result.ok).toBe(true);
      expect(createMock).toHaveBeenCalledWith({
        data: {
          name: "Feat",
          description: null,
          isActive: true,
        },
      });
    });
  });

  describe("updateIssueTypeAction", () => {
    it("rejects case-insensitive duplicate when updating to an existing type name", async () => {
      findFirstMock.mockResolvedValue({ id: "type-1", name: "Design" });

      const formData = new FormData();
      formData.set("name", "DESIGN");

      const result = await updateIssueTypeAction("type-2", formData);

      expect(result.error).toBe('Another type named "Design" already exists.');
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
