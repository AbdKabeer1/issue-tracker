import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    milestone: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    bug: { count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  setMilestoneClosedAction,
  updateMilestoneAction,
} from "./milestones";

const m = prisma.milestone as unknown as Record<"findFirst" | "create" | "update" | "delete", ReturnType<typeof vi.fn>>;
const bug = prisma.bug as unknown as Record<"count" | "updateMany" | "deleteMany", ReturnType<typeof vi.fn>>;

const fd = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};

describe("milestone actions (#289)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findFirst.mockResolvedValue(null);
  });

  it("requires an admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(createMilestoneAction(fd({ title: "v2" }))).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("creates with a calendar due date", async () => {
    expect(await createMilestoneAction(fd({ title: " v2.4 ", dueDate: "2026-10-31", description: "" }))).toEqual({ ok: true });
    expect(m.create).toHaveBeenCalledWith({
      data: { title: "v2.4", description: null, dueDate: new Date("2026-10-31T00:00:00.000Z") },
    });
  });

  it("rejects a duplicate title, ignoring case", async () => {
    m.findFirst.mockResolvedValue({ title: "V2.4" });
    expect((await createMilestoneAction(fd({ title: "v2.4" }))).error).toBe('A milestone named "V2.4" already exists.');
    expect(m.create).not.toHaveBeenCalled();
  });

  it("rejects an impossible date", async () => {
    expect((await createMilestoneAction(fd({ title: "v2.4", dueDate: "2026-02-30" }))).error).toMatch(/valid due date/);
  });

  it("clears the due date when emptied", async () => {
    await updateMilestoneAction("m1", fd({ title: "v2.4", dueDate: "" }));
    expect(m.update.mock.calls[0][0].data.dueDate).toBeNull();
  });

  it("closing touches only the milestone", async () => {
    expect(await setMilestoneClosedAction("m1", true)).toEqual({ ok: true });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { isClosed: true, closedAt: expect.any(Date) } });
    expect(bug.updateMany).not.toHaveBeenCalled();
  });

  it("deleting leaves the issues to the database's SET NULL and reports how many", async () => {
    bug.count.mockResolvedValue(4);
    expect(await deleteMilestoneAction("m1")).toEqual({ ok: true, cleared: 4 });
    expect(m.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(bug.deleteMany).not.toHaveBeenCalled();
  });

  it("says so when the milestone is already gone", async () => {
    m.delete.mockRejectedValue(Object.assign(new Error("gone"), { code: "P2025" }));
    bug.count.mockResolvedValue(0);
    expect((await deleteMilestoneAction("m1")).error).toMatch(/no longer exists/);
  });
});
