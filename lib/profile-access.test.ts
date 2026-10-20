import { describe, expect, it, vi } from "vitest";
import { canViewProfile } from "./profile-access";

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
