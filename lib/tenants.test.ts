import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
const cookieSet = vi.hoisted(() => vi.fn());
const cookiesFn = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesFn }));

import {
  ACTIVE_TENANT_COOKIE,
  createTenant,
  homePathFor,
  landingPath,
  memberTenantById,
  memberTenantBySlug,
  promoteFirstZeduOwner,
  readActiveTenantCookie,
  setActiveTenantCookie,
  slugFromName,
  tenantSlugCandidate,
  tenantsForUser,
  zeduNeedsOwner,
} from "./tenants";

beforeEach(() => {
  vi.clearAllMocks();
  cookiesFn.mockResolvedValue({ get: cookieGet, set: cookieSet });
  cookieGet.mockReturnValue(undefined);
});

// Two tenants and who is in them: enough to show that one person's view never
// includes another tenant.
const ZEDU = { id: "tenant-zedu", slug: "zedu", name: "Zedu" };
const ACME = { id: "tenant-acme", slug: "acme", name: "Acme Secret Project" };
const MEMBERSHIPS = [
  { userId: "ada", role: "member" as const, tenant: ZEDU },
  { userId: "ada", role: "owner" as const, tenant: ACME },
  { userId: "zed", role: "member" as const, tenant: ZEDU },
];

/** `membership.findFirst/findUnique/findMany` over MEMBERSHIPS, like Postgres would. */
function membershipDb() {
  const rows = (where: { userId?: string; tenantId?: string; tenant?: { slug: string } }) =>
    MEMBERSHIPS.filter(
      (m) =>
        (where.userId === undefined || m.userId === where.userId) &&
        (where.tenantId === undefined || m.tenant.id === where.tenantId) &&
        (where.tenant === undefined || m.tenant.slug === where.tenant.slug),
    );
  return {
    membership: {
      findMany: vi.fn(async ({ where, orderBy }: { where: { userId: string }; orderBy?: unknown }) =>
        rows(where)
          .map((m) => ({ role: m.role, tenant: { ...m.tenant }, tenantId: m.tenant.id }))
          .sort((a, b) => (orderBy ? a.tenant.name.localeCompare(b.tenant.name) : 0)),
      ),
      findFirst: vi.fn(async ({ where }: { where: { userId: string; tenant: { slug: string } } }) => {
        const m = rows(where)[0];
        return m ? { role: m.role, tenant: { ...m.tenant } } : null;
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { tenantId_userId: { tenantId: string; userId: string } } }) => {
          const m = rows(where.tenantId_userId)[0];
          return m ? { role: m.role, tenant: { ...m.tenant } } : null;
        },
      ),
    },
  };
}

describe("where a signed-in person lands (#444)", () => {
  it("opens the only tenant someone belongs to, never the picker", () => {
    expect(landingPath(["tenant-zedu"], null)).toBe("/issues");
    // Even a cookie for some other tenant doesn't put them on the picker.
    expect(landingPath(["tenant-zedu"], "tenant-acme")).toBe("/issues");
  });

  it("opens the tenant picked on this device when they belong to several", () => {
    expect(landingPath(["tenant-zedu", "tenant-acme"], "tenant-acme")).toBe("/issues");
  });

  it("shows the picker for several tenants and no pick, or a pick they aren't in", () => {
    expect(landingPath(["tenant-zedu", "tenant-acme"], null)).toBe("/tenants");
    expect(landingPath(["tenant-zedu", "tenant-acme"], "tenant-forged")).toBe("/tenants");
  });

  it("shows a brand-new account the picker, to create a tenant or accept an invite", () => {
    expect(landingPath([], null)).toBe("/tenants");
    expect(landingPath([], "tenant-zedu")).toBe("/tenants");
  });

  it("reads the memberships and this device's pick", async () => {
    const db = membershipDb();
    cookieGet.mockReturnValue({ value: "tenant-acme" });
    await expect(homePathFor(db as never, "ada")).resolves.toBe("/issues");
    expect(cookieGet).toHaveBeenCalledWith(ACTIVE_TENANT_COOKIE);

    cookieGet.mockReturnValue(undefined);
    await expect(homePathFor(db as never, "ada")).resolves.toBe("/tenants");
    await expect(homePathFor(db as never, "zed")).resolves.toBe("/issues");
    await expect(homePathFor(db as never, "new-account")).resolves.toBe("/tenants");
  });
});

describe("the person's tenants (#444)", () => {
  it("lists only tenants they belong to, with their role", async () => {
    const db = membershipDb();
    expect(await tenantsForUser(db as never, "zed")).toEqual([{ ...ZEDU, role: "member" }]);
    expect(await tenantsForUser(db as never, "ada")).toEqual([
      { ...ACME, role: "owner" },
      { ...ZEDU, role: "member" },
    ]);
    expect(await tenantsForUser(db as never, "new-account")).toEqual([]);
  });

  it("finds a tenant by slug only for its members: a guessed slug reveals nothing", async () => {
    const db = membershipDb();
    expect(await memberTenantBySlug(db as never, "ada", "acme")).toEqual({ ...ACME, role: "owner" });

    const guessed = await memberTenantBySlug(db as never, "zed", "acme");
    const missing = await memberTenantBySlug(db as never, "zed", "no-such-tenant");
    expect(guessed).toBeNull();
    expect(missing).toBeNull();
    // The lookup is scoped to the person, so another tenant's row is never read.
    expect(db.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "zed", tenant: { slug: "acme" } } }),
    );
  });

  it("doesn't query for something that can't be a slug", async () => {
    const db = membershipDb();
    expect(await memberTenantBySlug(db as never, "ada", "Acme Secret Project")).toBeNull();
    expect(await memberTenantBySlug(db as never, "ada", "../zedu")).toBeNull();
    expect(db.membership.findFirst).not.toHaveBeenCalled();
  });

  it("finds a tenant by id only for its members", async () => {
    const db = membershipDb();
    expect(await memberTenantById(db as never, "ada", "tenant-acme")).toEqual({ ...ACME, role: "owner" });
    expect(await memberTenantById(db as never, "zed", "tenant-acme")).toBeNull();
    expect(await memberTenantById(db as never, "zed", "")).toBeNull();
  });
});

describe("the tenant picked on this device (#444)", () => {
  it("is remembered in an http-only cookie", async () => {
    await setActiveTenantCookie("tenant-acme");
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVE_TENANT_COOKIE,
      "tenant-acme",
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax" }),
    );
  });

  it("is read back, and is nothing without a cookie jar", async () => {
    cookieGet.mockReturnValue({ value: "tenant-acme" });
    await expect(readActiveTenantCookie()).resolves.toBe("tenant-acme");
    cookiesFn.mockRejectedValueOnce(new Error("cookies was called outside a request scope"));
    await expect(readActiveTenantCookie()).resolves.toBeNull();
  });
});

describe("slugs (#444)", () => {
  it("follow the project rules", () => {
    expect(slugFromName("Àcme  Corp!", "tenant")).toBe("acme-corp");
    expect(slugFromName("***", "tenant")).toBe("tenant");
    expect(slugFromName("a".repeat(80), "tenant")).toHaveLength(48);
  });

  it("try the name first, then the name with a random tail", () => {
    expect(tenantSlugCandidate("acme", 0, () => "k3x9")).toBe("acme");
    expect(tenantSlugCandidate("acme", 1, () => "k3x9")).toBe("acme-k3x9");
    expect(tenantSlugCandidate("a".repeat(48), 1, () => "k3x9")).toHaveLength(48);
  });

  it("never hand out a slug that would shadow a route", () => {
    expect(tenantSlugCandidate("invite", 0, () => "k3x9")).toBe("invite-k3x9");
    expect(tenantSlugCandidate("new", 0, () => "k3x9")).toBe("new-k3x9");
  });
});

describe("createTenant (#444)", () => {
  function tenantDb(failures: unknown[] = []) {
    const create = vi.fn(async ({ data }: { data: { slug: string; name: string } }) => {
      const failure = failures.shift();
      if (failure) throw failure;
      return { id: "tenant-new", slug: data.slug, name: data.name, projects: [{ id: "project-new" }] };
    });
    return { tenant: { create } };
  }
  const slugTaken = Object.assign(new Error("Unique constraint failed on the fields: (`slug`)"), {
    code: "P2002",
  });

  it("makes the creator the owner of the new tenant and its first project", async () => {
    const db = tenantDb();
    const result = await createTenant(db as never, { id: "ada" }, { name: "  Acme   Corp ", projectName: "Acme Web" });

    expect(result).toEqual({
      ok: true,
      tenant: { id: "tenant-new", slug: "acme-corp", name: "Acme Corp" },
      projectId: "project-new",
    });
    expect(db.tenant.create).toHaveBeenCalledTimes(1);
    expect(db.tenant.create.mock.calls[0]![0]).toMatchObject({
      data: {
        slug: "acme-corp",
        name: "Acme Corp",
        // Exactly one membership: the creator's, as owner. Nobody else joins.
        memberships: { create: { userId: "ada", role: "owner" } },
        projects: { create: { slug: "acme-web", name: "Acme Web" } },
        categories: {
          create: [
            { name: "Desktop", isActive: true },
            { name: "Web", isActive: true },
            { name: "Mobile", isActive: true },
          ],
        },
      },
    });
  });

  it("names the first project after the tenant when none is given", async () => {
    const db = tenantDb();
    await createTenant(db as never, { id: "ada" }, { name: "Acme", projectName: "   " });
    expect(db.tenant.create.mock.calls[0]![0]).toMatchObject({
      data: { projects: { create: { slug: "acme", name: "Acme" } } },
    });
  });

  it("tries a random tail when the slug is taken", async () => {
    const db = tenantDb([slugTaken]);
    const result = await createTenant(db as never, { id: "ada" }, { name: "Zedu" }, () => "k3x9");
    expect(result).toMatchObject({ ok: true, tenant: { slug: "zedu-k3x9", name: "Zedu" } });
    expect(db.tenant.create.mock.calls.map((call) => call[0].data.slug)).toEqual(["zedu", "zedu-k3x9"]);
  });

  it("gives up after a few taken slugs, and passes other errors on", async () => {
    const busy = tenantDb([slugTaken, slugTaken, slugTaken, slugTaken, slugTaken]);
    expect(await createTenant(busy as never, { id: "ada" }, { name: "Zedu" })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(busy.tenant.create).toHaveBeenCalledTimes(5);

    const down = tenantDb([new Error("connection lost")]);
    await expect(createTenant(down as never, { id: "ada" }, { name: "Acme" })).rejects.toThrow("connection lost");
  });

  it("rejects names that are too short, too long or not one line", async () => {
    const db = tenantDb();
    expect(await createTenant(db as never, { id: "ada" }, { name: " a " })).toEqual({
      ok: false,
      error: "Tenant name must be at least 2 characters.",
      field: "name",
    });
    expect(await createTenant(db as never, { id: "ada" }, { name: "x".repeat(61) })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(await createTenant(db as never, { id: "ada" }, { name: "Acme\u0000Corp" })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(await createTenant(db as never, { id: "ada" }, { name: "Acme", projectName: "W" })).toEqual({
      ok: false,
      error: "Project name must be at least 2 characters.",
      field: "projectName",
    });
    expect(await createTenant(db as never, { id: "ada" }, {})).toMatchObject({ ok: false, field: "name" });
    expect(db.tenant.create).not.toHaveBeenCalled();
  });
});

describe("Zedu's first owner (#444)", () => {
  function zeduDb({ owners = 0, member = true }: { owners?: number; member?: boolean } = {}) {
    return {
      tenant: { findUnique: vi.fn(async () => ({ id: "tenant-zedu" })) },
      membership: {
        count: vi.fn(async () => owners),
        findFirst: vi.fn(async () => (member ? { id: "mem-1", user: { name: "Goodness" } } : null)),
        update: vi.fn(async () => ({})),
        create: vi.fn(),
        upsert: vi.fn(),
      },
    };
  }

  it("is needed until Zedu has an owner", async () => {
    expect(await zeduNeedsOwner(zeduDb() as never)).toBe(true);
    expect(await zeduNeedsOwner(zeduDb({ owners: 1 }) as never)).toBe(false);
  });

  it("is chosen by the super admin from Zedu's existing members", async () => {
    const db = zeduDb();
    expect(await promoteFirstZeduOwner(db as never, { role: "super_admin" }, " Lead@Zedu.chat ")).toEqual({
      ok: true,
      name: "Goodness",
    });
    expect(db.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-zedu", user: { email: { equals: "lead@zedu.chat", mode: "insensitive" } } },
      }),
    );
    expect(db.membership.update).toHaveBeenCalledWith({ where: { id: "mem-1" }, data: { role: "owner" } });
  });

  it("can't be chosen by anyone else, even a site admin", async () => {
    for (const role of ["admin", "user", null] as const) {
      const db = zeduDb();
      expect(await promoteFirstZeduOwner(db as never, { role }, "lead@zedu.chat")).toMatchObject({ ok: false });
      expect(db.membership.update).not.toHaveBeenCalled();
    }
  });

  it("never adds anyone to Zedu: someone outside it can't be made owner", async () => {
    const db = zeduDb({ member: false });
    expect(await promoteFirstZeduOwner(db as never, { role: "super_admin" }, "new@example.com")).toMatchObject({
      ok: false,
      field: "email",
    });
    expect(db.membership.update).not.toHaveBeenCalled();
    expect(db.membership.create).not.toHaveBeenCalled();
    expect(db.membership.upsert).not.toHaveBeenCalled();
  });

  it("is only the first owner: once Zedu has one, the super admin has no say", async () => {
    const db = zeduDb({ owners: 1 });
    expect(await promoteFirstZeduOwner(db as never, { role: "super_admin" }, "lead@zedu.chat")).toEqual({
      ok: false,
      error: "Zedu already has an owner.",
    });
    expect(db.membership.update).not.toHaveBeenCalled();
  });

  it("needs a valid email", async () => {
    const db = zeduDb();
    expect(await promoteFirstZeduOwner(db as never, { role: "super_admin" }, "nope")).toMatchObject({
      ok: false,
      field: "email",
    });
  });
});
