import { describe, expect, it, vi } from "vitest";
import { canViewProfile, canViewWallet } from "./profile-access";

function dbWith(shared: boolean) {
  return { membership: { findFirst: vi.fn(async () => (shared ? { id: "m-1" } : null)) } };
}

describe("canViewProfile (#503)", () => {
  it("lets people see their own profile without a lookup", async () => {
    const db = dbWith(false);
    expect(await canViewProfile(db as never, { id: "u1", role: "user" }, "u1")).toBe(true);
    expect(db.membership.findFirst).not.toHaveBeenCalled();
  });

  it("lets the super admin see anyone", async () => {
    const db = dbWith(false);
    expect(await canViewProfile(db as never, { id: "boss", role: "super_admin" }, "u2")).toBe(true);
  });

  it("does not treat the global admin role as a pass", async () => {
    const db = dbWith(false);
    expect(await canViewProfile(db as never, { id: "alice", role: "admin" }, "dave")).toBe(false);
  });

  it("needs a tenant both people belong to", async () => {
    expect(await canViewProfile(dbWith(true) as never, { id: "u1", role: "user" }, "u2")).toBe(true);
    expect(await canViewProfile(dbWith(false) as never, { id: "u1", role: "user" }, "u2")).toBe(false);
  });
});

/** The viewer's membership of one tenant, or none. */
function walletDb(role: "owner" | "admin" | "member" | null) {
  return {
    membership: { findUnique: vi.fn(async () => (role ? { role } : null)) },
  };
}

describe("canViewWallet (#618)", () => {
  it("lets people see their own wallet without a lookup", async () => {
    const db = walletDb(null);
    expect(await canViewWallet(db as never, { id: "u1", role: "user" }, "u1", "tenant-zedu")).toBe(true);
    expect(db.membership.findUnique).not.toHaveBeenCalled();
  });

  it("lets an owner or admin of the shared tenant see it", async () => {
    for (const role of ["owner", "admin"] as const) {
      expect(
        await canViewWallet(walletDb(role) as never, { id: "u1", role: "user" }, "u2", "tenant-zedu"),
      ).toBe(true);
    }
  });

  it("does not show it to an ordinary member, or to a site-wide admin", async () => {
    expect(
      await canViewWallet(walletDb("member") as never, { id: "u1", role: "user" }, "u2", "tenant-zedu"),
    ).toBe(false);
    // A site-wide `admin` must not follow someone into an organization (#618, #503).
    expect(
      await canViewWallet(walletDb("member") as never, { id: "u1", role: "admin" }, "u2", "tenant-zedu"),
    ).toBe(false);
  });

  it("counts the super admin as an admin of any tenant", async () => {
    expect(
      await canViewWallet(walletDb(null) as never, { id: "boss", role: "super_admin" }, "u2", "tenant-zedu"),
    ).toBe(true);
  });

  it("shows nothing to a stranger when there is no tenant to judge them by", async () => {
    const db = walletDb("owner");
    expect(await canViewWallet(db as never, { id: "u1", role: "user" }, "u2", null)).toBe(false);
    expect(db.membership.findUnique).not.toHaveBeenCalled();
    // Not a member of this tenant at all.
    expect(
      await canViewWallet(walletDb(null) as never, { id: "u1", role: "user" }, "u2", "tenant-zedu"),
    ).toBe(false);
  });
});
