import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PointsExportSecretError,
  buildPointsSnapshot,
  pointsExportSecret,
  snapshotContent,
  snapshotCsv,
  snapshotHash,
  snapshotJson,
  snapshotSignature,
} from "./snapshot";

const cutoff = new Date("2026-10-20T00:00:00.000Z");
const otherCutoff = new Date("2026-10-21T00:00:00.000Z");

const ada = { id: "u_ada", name: "Ada", walletAddress: "0x" + "a".repeat(40) };
const bola = { id: "u_bola", name: "Bola, Jr.", walletAddress: null };

/** A ledger: groupBy rows (already summed) and the users behind them. */
function dbWith(groups: Array<{ userId: string; _sum: { points: number | null }; _count: { _all: number } }>) {
  return {
    pointEntry: { groupBy: vi.fn(async () => groups) },
    user: { findMany: vi.fn(async () => [ada, bola]) },
  };
}

const group = (userId: string, points: number, entries: number) => ({
  userId,
  _sum: { points },
  _count: { _all: entries },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildPointsSnapshot (#618)", () => {
  it("sums the ledger up to the cutoff and orders people by id", async () => {
    const db = dbWith([group("u_bola", 40, 2), group("u_ada", 65, 3)]);

    const snapshot = await buildPointsSnapshot(db as never, { tenantId: "tenant-zedu", cutoff });

    expect(db.pointEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-zedu", createdAt: { lte: cutoff } },
    }));
    expect(snapshot).toEqual({
      tenantId: "tenant-zedu",
      cutoff: "2026-10-20T00:00:00.000Z",
      rows: [
        { userId: "u_ada", name: "Ada", points: 65, entries: 3, walletAddress: "0x" + "a".repeat(40) },
        { userId: "u_bola", name: "Bola, Jr.", points: 40, entries: 2, walletAddress: null },
      ],
    });
  });

  it("gives the same hash for the same cutoff, whatever order the rows come back in", async () => {
    const first = await buildPointsSnapshot(
      dbWith([group("u_ada", 65, 3), group("u_bola", 40, 2)]) as never,
      { tenantId: "tenant-zedu", cutoff },
    );
    const second = await buildPointsSnapshot(
      dbWith([group("u_bola", 40, 2), group("u_ada", 65, 3)]) as never,
      { tenantId: "tenant-zedu", cutoff },
    );

    expect(snapshotContent(first)).toBe(snapshotContent(second));
    expect(snapshotHash(first)).toBe(snapshotHash(second));
    expect(snapshotHash(first)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the hash when the cutoff moves, even over the same rows", async () => {
    const at = await buildPointsSnapshot(dbWith([group("u_ada", 65, 3)]) as never, {
      tenantId: "tenant-zedu",
      cutoff,
    });
    const later = await buildPointsSnapshot(dbWith([group("u_ada", 65, 3)]) as never, {
      tenantId: "tenant-zedu",
      cutoff: otherCutoff,
    });

    expect(snapshotHash(at)).not.toBe(snapshotHash(later));
  });

  it("keeps both files in the row order and puts the hash and signature in the JSON", async () => {
    const db = dbWith([group("u_bola", 40, 2), group("u_ada", 65, 3)]);
    const snapshot = await buildPointsSnapshot(db as never, { tenantId: "tenant-zedu", cutoff });
    const hash = snapshotHash(snapshot);
    const signature = snapshotSignature({ hash, secret: "s3cret" });

    const csv = snapshotCsv(snapshot);
    expect(csv.split("\r\n")[0]).toBe("user_id,name,points,entries,wallet_address");
    // csvRow quotes the comma in the name; rows stay in snapshot order.
    expect(csv.indexOf("u_ada")).toBeLessThan(csv.indexOf("u_bola"));
    expect(csv).toContain(`0x${"a".repeat(40)}`);

    const json = JSON.parse(snapshotJson(snapshot, { hash, signature }));
    expect(json.contentHash).toBe(hash);
    expect(json.signature).toBe(signature);
    expect(json.cutoff).toBe("2026-10-20T00:00:00.000Z");
    expect(json.rows.map((row: { userId: string }) => row.userId)).toEqual(["u_ada", "u_bola"]);
    expect(snapshotJson(snapshot, { hash, signature })).toBe(
      snapshotJson(snapshot, { hash, signature }),
    );
  });

  it("signs the hash with the export secret, and only that", async () => {
    const hash = "0".repeat(64);
    expect(snapshotSignature({ hash, secret: "one" })).toBe(snapshotSignature({ hash, secret: "one" }));
    expect(snapshotSignature({ hash, secret: "one" })).not.toBe(snapshotSignature({ hash, secret: "two" }));
    expect(snapshotSignature({ hash, secret: "one" })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("pointsExportSecret (#618)", () => {
  it("reads the secret from the environment and never a default", () => {
    vi.stubEnv("POINTS_EXPORT_SECRET", "openssl-rand-output");
    expect(pointsExportSecret()).toBe("openssl-rand-output");
  });

  it("refuses to sign when it is unset", () => {
    vi.stubEnv("POINTS_EXPORT_SECRET", "");
    expect(() => pointsExportSecret()).toThrow(PointsExportSecretError);
    expect(() => pointsExportSecret()).toThrow("POINTS_EXPORT_SECRET");
  });
});
