import { describe, expect, it, vi } from "vitest";
import { linkAttachments } from "./attachment-link";

describe("linkAttachments (#215)", () => {
  it("only claims the uploader's own unlinked files", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const count = await linkAttachments({ attachment: { updateMany } } as never, {
      ids: ["a1", "a2"],
      uploaderId: "u1",
      bugId: "b1",
      commentId: "c1",
    });
    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] }, uploaderId: "u1", bugId: null, commentId: null },
      data: { bugId: "b1", commentId: "c1" },
    });
  });

  it("does nothing without ids", async () => {
    const updateMany = vi.fn();
    await expect(
      linkAttachments({ attachment: { updateMany } } as never, { ids: [], uploaderId: "u1", bugId: "b1" }),
    ).resolves.toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
