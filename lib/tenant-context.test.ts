import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  bugInTenant,
  commentInTenant,
  defaultProjectIdFor,
  notificationInTenant,
  pickTenantId,
  tenantIdForUser,
} from "./tenant-context";

const zedu = { tenantId: "tenant-zedu", tenant: { slug: "zedu" } };
const other = { tenantId: "tenant-other", tenant: { slug: "acme" } };

/** A tiny stand-in for Postgres: does `row` match a `{ tenantId }` scope? */
function matches(row: { tenantId: string }, scope: ReturnType<typeof bugInTenant>): boolean {
  return typeof scope.tenantId === "string"
    ? row.tenantId === scope.tenantId
    : scope.tenantId.in.includes(row.tenantId);
}

describe("tenant context (#425)", () => {
  describe("pickTenantId", () => {
    it("opens Zedu for a Zedu member, even with other memberships", () => {
      expect(pickTenantId([other, zedu])).toBe("tenant-zedu");
    });

    it("opens the oldest membership for someone outside Zedu", () => {
      expect(pickTenantId([other])).toBe("tenant-other");
    });

    it("gives a new account with no membership no tenant at all", () => {
      expect(pickTenantId([])).toBeNull();
    });
  });

  describe("tenantIdForUser", () => {
    it("resolves the tenant from the person's memberships", async () => {
      const findMany = vi.fn().mockResolvedValue([zedu]);
      const db = { membership: { findMany } } as never;
      expect(await tenantIdForUser(db, "user-1")).toBe("tenant-zedu");
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    });

    it("has no tenant without a signed-in person, and doesn't query", async () => {
      const findMany = vi.fn();
      const db = { membership: { findMany } } as never;
      expect(await tenantIdForUser(db, undefined)).toBeNull();
      expect(findMany).not.toHaveBeenCalled();
    });

    it("has no tenant for a signed-in person with no membership", async () => {
      const db = { membership: { findMany: vi.fn().mockResolvedValue([]) } } as never;
      expect(await tenantIdForUser(db, "new-user")).toBeNull();
    });
  });

  describe("scopes", () => {
    const issues = [
      { id: "zedu-1", tenantId: "tenant-zedu" },
      { id: "other-1", tenantId: "tenant-other" },
    ];

    it("keeps a second tenant's issues out of the Zedu session", () => {
      const visible = issues.filter((issue) => matches(issue, bugInTenant("tenant-zedu")));
      expect(visible.map((i) => i.id)).toEqual(["zedu-1"]);
    });

    it("shows no issues at all without a tenant", () => {
      expect(bugInTenant(null)).toEqual({ tenantId: { in: [] } });
      expect(issues.filter((issue) => matches(issue, bugInTenant(null)))).toEqual([]);
    });

    it("scopes comments through their issue", () => {
      expect(commentInTenant("tenant-zedu")).toEqual({ bug: { tenantId: "tenant-zedu" } });
    });

    it("keeps personal notifications, and only this tenant's issue notifications", () => {
      expect(notificationInTenant("tenant-zedu")).toEqual({
        OR: [{ bugId: null }, { bug: { tenantId: "tenant-zedu" } }],
      });
      expect(notificationInTenant(null)).toEqual({ bugId: null });
    });
  });

  describe("defaultProjectIdFor", () => {
    it("files new issues into the tenant's Zedu project", async () => {
      const db = {
        project: {
          findMany: vi.fn().mockResolvedValue([
            { id: "project-web", slug: "web" },
            { id: "project-zedu", slug: "zedu" },
          ]),
        },
      } as never;
      expect(await defaultProjectIdFor(db, "tenant-zedu")).toBe("project-zedu");
    });

    it("falls back to the oldest project, or none", async () => {
      const one = { project: { findMany: vi.fn().mockResolvedValue([{ id: "p1", slug: "web" }]) } } as never;
      const none = { project: { findMany: vi.fn().mockResolvedValue([]) } } as never;
      expect(await defaultProjectIdFor(one, "t")).toBe("p1");
      expect(await defaultProjectIdFor(none, "t")).toBeNull();
    });
  });
});
