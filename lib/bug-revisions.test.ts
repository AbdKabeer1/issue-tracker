import { describe, expect, it } from "vitest";
import { buildVersions, DELETED_EDITOR } from "./bug-revisions";

const d = (s: string) => new Date(s);

describe("buildVersions", () => {
  const current = { title: "T3", description: "D3", createdAt: d("2026-01-01"), reporterName: "Rae" };

  it("is just the current issue when it was never edited", () => {
    expect(buildVersions(current, [])).toEqual([
      { number: 1, title: "T3", description: "D3", author: "Rae", at: d("2026-01-01"), isCurrent: true },
    ]);
  });

  it("credits each version to whoever made the edit that produced it", () => {
    const v = buildVersions(current, [
      { id: "r2", title: "T2", description: "D2", editedAt: d("2026-01-03"), editedBy: { name: "Ann" } },
      { id: "r1", title: "T1", description: "D1", editedAt: d("2026-01-02"), editedBy: { name: "Rae" } },
    ]);
    expect(v.map((x) => [x.number, x.title, x.author, x.isCurrent])).toEqual([
      [1, "T1", "Rae", false],
      [2, "T2", "Rae", false],
      [3, "T3", "Ann", true],
    ]);
    expect(v[2].at).toEqual(d("2026-01-03"));
  });

  it("names a deleted editor plainly", () => {
    const v = buildVersions(current, [
      { id: "r1", title: "T1", description: "D1", editedAt: d("2026-01-02"), editedBy: null },
    ]);
    expect(v[1].author).toBe(DELETED_EDITOR);
  });
});
