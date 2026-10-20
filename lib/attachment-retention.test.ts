import { describe, expect, it, vi } from "vitest";
import { pruneUnlinkedUploads, SWEEP_BATCH, UNLINKED_UPLOAD_TTL_MS } from "./attachment-retention";

const now = new Date("2026-10-20T12:00:00Z");
const cutoff = new Date(now.getTime() - UNLINKED_UPLOAD_TTL_MS);
const unlinked = { bugId: null, commentId: null, redesignProposalId: null, createdAt: { lt: cutoff } };

function fakeDb(stale: string[] = []) {
  return {
    attachment: {
      deleteMany: vi.fn(async ({ where }: { where: { id?: { in: string[] } } }) => ({ count: where.id ? where.id.in.length : 2 })),
      findMany: vi.fn(async () => stale.map((id) => ({ id }))),
    },
  };
}

describe("pruneUnlinkedUploads (#543)", () => {
  it("deletes only this uploader's uploads that were never attached and are over a week old", async () => {
    const db = fakeDb();
    const result = await pruneUnlinkedUploads(db as never, { uploaderId: "u1", now, siteSweep: false });
    expect(db.attachment.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.attachment.deleteMany).toHaveBeenCalledWith({ where: { uploaderId: "u1", ...unlinked } });
    expect(db.attachment.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ own: 2, site: 0 });
  });

  it("keeps uploads from the last week, so unsent drafts don't lose their images", () => {
    expect(UNLINKED_UPLOAD_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("sometimes sweeps everyone's expired uploads, in a bounded batch", async () => {
    const db = fakeDb(["a", "b", "c"]);
    const result = await pruneUnlinkedUploads(db as never, { uploaderId: "u1", now, siteSweep: true });
    expect(db.attachment.findMany).toHaveBeenCalledWith({ where: unlinked, select: { id: true }, take: SWEEP_BATCH });
    // The delete re-checks "still unlinked", so one attached in between survives.
    expect(db.attachment.deleteMany).toHaveBeenLastCalledWith({ where: { id: { in: ["a", "b", "c"] }, ...unlinked } });
    expect(result.site).toBe(3);
  });

  it("does nothing more when the sweep finds nothing", async () => {
    const db = fakeDb([]);
    await pruneUnlinkedUploads(db as never, { uploaderId: "u1", now, siteSweep: true });
    expect(db.attachment.deleteMany).toHaveBeenCalledTimes(1);
  });
});
