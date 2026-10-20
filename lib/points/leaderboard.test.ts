import { describe, expect, it, vi } from "vitest";
import { pointTotals, rankLeaderboard, tenantLeaderboard } from "./leaderboard";

const person = (userId: string, name: string, points: number, solvedTasks: number) => ({
  userId,
  name,
  image: null,
  points,
  solvedTasks,
});

describe("leaderboard (#428)", () => {
  it("ranks by points, then solved tasks, then name", () => {
    const ranked = rankLeaderboard([
      person("c", "Chi", 40, 1),
      person("a", "Ada", 100, 3),
      person("b", "Bola", 40, 2),
    ]);
    expect(ranked.map((r) => [r.rank, r.name])).toEqual([
      [1, "Ada"],
      [2, "Bola"],
      [3, "Chi"],
    ]);
  });

  it("gives people level on points and solved tasks the same rank", () => {
    const ranked = rankLeaderboard([
      person("a", "Ada", 100, 3),
      person("b", "Bola", 40, 2),
      person("c", "Chi", 40, 2),
      person("d", "Dayo", 15, 1),
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("totals a person's balance, corrections included, and their solved tasks", async () => {
    const aggregate = vi.fn().mockResolvedValue({ _sum: { points: 65 } });
    const count = vi.fn().mockResolvedValue(2);
    const db = { pointEntry: { aggregate, count } } as never;

    expect(await pointTotals(db, "tenant-zedu", "user-1")).toEqual({ points: 65, solvedTasks: 2 });
    expect(aggregate.mock.calls[0][0].where).toEqual({ tenantId: "tenant-zedu", userId: "user-1" });
    // A solved task is a positive, uncorrected solver entry.
    expect(count.mock.calls[0][0].where).toEqual({
      tenantId: "tenant-zedu",
      role: "solver",
      points: { gt: 0 },
      correctedAt: null,
      userId: "user-1",
    });
  });

  it("starts at zero with no ledger rows", async () => {
    const db = {
      pointEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { points: null } }),
        count: vi.fn().mockResolvedValue(0),
      },
    } as never;
    expect(await pointTotals(db, "tenant-zedu", "user-1")).toEqual({ points: 0, solvedTasks: 0 });
  });

  it("ranks only members of the current tenant", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { userId: "u1", _sum: { points: 25 } },
        { userId: "u2", _sum: { points: 60 } },
      ])
      .mockResolvedValueOnce([{ userId: "u2", _count: { _all: 1 } }]);
    const findMany = vi.fn().mockResolvedValue([
      { id: "u1", name: "Ada", image: null },
      { id: "u2", name: "Bola", image: null },
    ]);
    const db = { pointEntry: { groupBy }, user: { findMany } } as never;

    const rows = await tenantLeaderboard(db, "tenant-zedu");

    for (const call of groupBy.mock.calls) {
      expect(call[0].where).toMatchObject({
        tenantId: "tenant-zedu",
        user: { memberships: { some: { tenantId: "tenant-zedu" } } },
      });
    }
    expect(rows).toEqual([
      { userId: "u2", name: "Bola", image: null, points: 60, solvedTasks: 1, rank: 1 },
      { userId: "u1", name: "Ada", image: null, points: 25, solvedTasks: 0, rank: 2 },
    ]);
  });

  it("is empty when nobody has points", async () => {
    const db = { pointEntry: { groupBy: vi.fn().mockResolvedValue([]) }, user: { findMany: vi.fn() } } as never;
    expect(await tenantLeaderboard(db, "tenant-zedu")).toEqual([]);
  });
});
