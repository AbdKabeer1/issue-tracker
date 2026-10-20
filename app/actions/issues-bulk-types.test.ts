import { beforeEach, describe, expect, it, vi } from "vitest";

const publishWebEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/agent-api/web-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent-api/web-events")>()),
  publishWebEvent,
}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), access: vi.fn(), active: false,
  db: {
    issueType: { findUnique: vi.fn() }, bug: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: { bug: { updateMany: vi.fn() }, bugActivity: { createMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/tenant-access", () => ({ currentTenantAccess: mocks.access }));
vi.mock("@/lib/tenant-context", () => ({
  currentTenantIdFor: async () => "tenant-1",
  bugInTenant: () => ({ tenantId: "tenant-1" }),
}));
vi.mock("@/lib/points/award", () => ({ awardSolver: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import { bulkUpdateBugsAction } from "./issues-bulk";
import { revalidatePath } from "next/cache";

function bug(id: string, typeId: string | null = "original-type", isDeleted = false) {
  return {
    id, tenantId: "tenant-1", isDeleted, typeId,
    status: "open", severity: "medium", assigneeId: null, categoryId: null,
    type: typeId ? { name: typeId } : null, category: null, assignee: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.active = false;
  mocks.requireUser.mockResolvedValue({ id: "admin-1", role: "admin" });
  mocks.access.mockResolvedValue({ admin: true });
  // Return only selected columns, as Prisma does.
  mocks.db.issueType.findUnique.mockImplementation(async ({ select }) => ({
    ...(select.id ? { id: "target-type" } : {}),
    ...(select.isActive ? { isActive: mocks.active } : {}),
    ...(select.name ? { name: "Target type" } : {}),
  }));
  mocks.db.bug.findMany.mockResolvedValue([bug("b1")]);
  mocks.tx.bug.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.bugActivity.createMany.mockResolvedValue({ count: 1 });
  mocks.db.$transaction.mockImplementation(async (run) => run(mocks.tx));
});

describe("bulk issue type validation (#718)", () => {
  it("rejects assigning an inactive type before writing anything", async () => {
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "target-type" })).toMatchObject({ error: expect.stringMatching(/inactive/i) });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.bugActivity.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a mixed batch even if one issue already has the inactive type", async () => {
    mocks.db.bug.findMany.mockResolvedValue([bug("b1", "target-type"), bug("b2")]);
    expect(await bulkUpdateBugsAction(["b1", "b2"], { typeId: "target-type" })).toMatchObject({ error: expect.stringMatching(/inactive/i) });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("keeps an unchanged inactive type as a no-op", async () => {
    mocks.db.bug.findMany.mockResolvedValue([bug("b1", "target-type")]);
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "target-type" })).toEqual({ ok: true, updated: 0, skipped: [] });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("allows another field to change while the inactive type stays unchanged", async () => {
    mocks.db.bug.findMany.mockResolvedValue([bug("b1", "target-type")]);
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "target-type", severity: "high" })).toEqual({ ok: true, updated: 1, skipped: [] });
    expect(mocks.tx.bug.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { typeId: "target-type", severity: "high" } }));
    expect(mocks.tx.bugActivity.createMany.mock.calls[0][0].data.map((entry: { type: string }) => entry.type)).toEqual(["severity_changed"]);
  });

  it("does not treat skipped deleted issues as new inactive assignments", async () => {
    mocks.db.bug.findMany.mockResolvedValue([bug("b1", "target-type"), bug("b2", "original-type", true)]);
    const result = await bulkUpdateBugsAction(["b1", "b2"], { typeId: "target-type", severity: "high" });
    expect(result).toMatchObject({ ok: true, updated: 1, skipped: [{ id: "b2" }] });
  });

  it("allows a newly assigned active type", async () => {
    mocks.active = true;
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "target-type" })).toEqual({ ok: true, updated: 1, skipped: [] });
    expect(revalidatePath).toHaveBeenCalledWith("/issues");
  });

  it("allows clearing a type without a type lookup", async () => {
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "" })).toEqual({ ok: true, updated: 1, skipped: [] });
    expect(mocks.db.issueType.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.bug.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { typeId: null } }));
  });

  it("still rejects a nonexistent type", async () => {
    mocks.db.issueType.findUnique.mockResolvedValueOnce(null);
    expect(await bulkUpdateBugsAction(["b1"], { typeId: "missing" })).toEqual({ error: "Issue type not found" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid input before querying types", async () => {
    expect((await bulkUpdateBugsAction([], { typeId: "target-type" })).error).toBeTruthy();
    expect(mocks.db.issueType.findUnique).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error("Not authenticated"));
    await expect(bulkUpdateBugsAction(["b1"], { typeId: "target-type" })).rejects.toThrow("Not authenticated");
    expect(mocks.db.bug.findMany).not.toHaveBeenCalled();
  });

  it("requires tenant admin access", async () => {
    mocks.access.mockResolvedValueOnce({ admin: false });
    await expect(bulkUpdateBugsAction(["b1"], { typeId: "target-type" })).rejects.toThrow("redirect:/issues");
    expect(mocks.db.bug.findMany).not.toHaveBeenCalled();
  });
});
