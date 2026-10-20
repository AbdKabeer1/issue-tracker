import { describe, expect, it, vi } from "vitest";
import { issueTenantHintFor } from "./issue-tenant-hint";

type Db = {
  bug: { findUnique: ReturnType<typeof vi.fn> };
  membership: { findFirst: ReturnType<typeof vi.fn> };
};

function fakeDb(rows: {
  bug?: { tenantId: string } | null;
  membership?: { tenant: { id: string; name: string; slug: string } } | null;
}): Db {
  return {
    bug: { findUnique: vi.fn(async () => rows.bug ?? null) },
    membership: { findFirst: vi.fn(async () => rows.membership ?? null) },
  };
}

const acme = { id: "tenant-acme", name: "Acme", slug: "acme" };

describe("issueTenantHintFor (#519)", () => {
  it("points a member at the tenant that owns the issue", async () => {
    const db = fakeDb({ bug: { tenantId: "tenant-acme" }, membership: { tenant: acme } });
    await expect(
      issueTenantHintFor(db as never, {
        userId: "dave",
        activeTenantId: "tenant-other",
        issueId: "bug1",
      }),
    ).resolves.toEqual(acme);
    expect(db.bug.findUnique).toHaveBeenCalledWith({
      where: { id: "bug1", isDeleted: false },
      select: { tenantId: true },
    });
    expect(db.membership.findFirst).toHaveBeenCalledWith({
      where: { userId: "dave", tenantId: "tenant-acme" },
      select: { tenant: { select: { id: true, name: true, slug: true } } },
    });
  });

  it("says nothing when the issue is already in the active tenant", async () => {
    const db = fakeDb({ bug: { tenantId: "tenant-acme" }, membership: { tenant: acme } });
    await expect(
      issueTenantHintFor(db as never, {
        userId: "dave",
        activeTenantId: "tenant-acme",
        issueId: "bug1",
      }),
    ).resolves.toBeNull();
    expect(db.membership.findFirst).not.toHaveBeenCalled();
  });

  it("says nothing to someone who is not a member (no tenant leak)", async () => {
    const db = fakeDb({ bug: { tenantId: "tenant-acme" }, membership: null });
    await expect(
      issueTenantHintFor(db as never, {
        userId: "stranger",
        activeTenantId: "tenant-other",
        issueId: "bug1",
      }),
    ).resolves.toBeNull();
  });

  it("says nothing for a missing or deleted issue", async () => {
    const db = fakeDb({ bug: null });
    await expect(
      issueTenantHintFor(db as never, {
        userId: "dave",
        activeTenantId: "tenant-other",
        issueId: "gone",
      }),
    ).resolves.toBeNull();
    expect(db.membership.findFirst).not.toHaveBeenCalled();
  });

  it("fails closed when the lookup fails", async () => {
    const db = fakeDb({});
    db.bug.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(
      issueTenantHintFor(db as never, {
        userId: "dave",
        activeTenantId: "tenant-other",
        issueId: "bug1",
      }),
    ).resolves.toBeNull();
  });
});
