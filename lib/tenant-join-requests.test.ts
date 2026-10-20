/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import {
  discoverableTenants,
  pendingTenantJoinRequests,
  requestTenantMembership,
  reviewTenantMembershipRequest,
} from "./tenant-join-requests";

describe("tenant-join-requests", () => {
  it("discovers public workspaces excluding caller memberships", async () => {
    const db = {
      tenant: {
        findMany: vi.fn().mockResolvedValue([{ id: "t1", name: "Zedu", slug: "zedu", discoverable: true }]),
      },
    } as any;

    const tenants = await discoverableTenants(db, "user-1");
    expect(tenants).toHaveLength(1);
    expect(db.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { discoverable: true, memberships: { none: { userId: "user-1" } } },
      }),
    );
  });

  it("lists pending join requests for a tenant", async () => {
    const db = {
      tenantJoinRequest: {
        findMany: vi.fn().mockResolvedValue([{ id: "r1", status: "pending" }]),
      },
    } as any;

    const requests = await pendingTenantJoinRequests(db, "t1");
    expect(requests).toHaveLength(1);
    expect(db.tenantJoinRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", status: "pending" },
      }),
    );
  });

  it("rejects request if tenantId is missing or user already belongs", async () => {
    const db = {
      membership: {
        findUnique: vi.fn().mockResolvedValue({ id: "m1" }),
      },
    } as any;

    const empty = await requestTenantMembership(db, "u1", "");
    expect(empty).toEqual({ ok: false, error: "Choose a workspace." });

    const member = await requestTenantMembership(db, "u1", "t1");
    expect(member).toEqual({ ok: false, error: "You already belong to this workspace." });
  });

  it("creates a new join request when not existing", async () => {
    const db = {
      membership: { findUnique: vi.fn().mockResolvedValue(null) },
      tenant: { findFirst: vi.fn().mockResolvedValue({ id: "t1", name: "Tenant 1", slug: "t1" }) },
      tenantJoinRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "req-1" }),
      },
    } as any;

    const res = await requestTenantMembership(db, "u1", "t1");
    expect(res).toEqual({
      ok: true,
      requestId: "req-1",
      tenantId: "t1",
      tenantName: "Tenant 1",
      slug: "t1",
      created: true,
    });
  });

  it("reopens existing non-pending request", async () => {
    const db = {
      membership: { findUnique: vi.fn().mockResolvedValue(null) },
      tenant: { findFirst: vi.fn().mockResolvedValue({ id: "t1", name: "Tenant 1", slug: "t1" }) },
      tenantJoinRequest: {
        findUnique: vi.fn().mockResolvedValue({ id: "req-1", status: "rejected" }),
        update: vi.fn().mockResolvedValue({ id: "req-1" }),
      },
    } as any;

    const res = await requestTenantMembership(db, "u1", "t1");
    expect(res).toEqual({
      ok: true,
      requestId: "req-1",
      tenantId: "t1",
      tenantName: "Tenant 1",
      slug: "t1",
      created: true,
    });
  });

  it("reviews request: adds member on approval", async () => {
    const req = {
      id: "req-1",
      status: "pending",
      userId: "u1",
      tenantId: "t1",
      tenant: { name: "Tenant 1", slug: "t1" },
      user: { name: "User 1", email: "user@example.com" },
    };
    const tx = {
      tenantJoinRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      membership: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      tenantJoinRequest: {
        findUnique: vi.fn().mockResolvedValue(req),
      },
      $transaction: vi.fn().mockImplementation((cb) => cb(tx)),
    } as any;

    const res = await reviewTenantMembershipRequest(db, {
      requestId: "req-1",
      reviewerId: "reviewer-1",
      status: "approved",
    });

    expect(res).toEqual({
      ok: true,
      requestId: "req-1",
      status: "approved",
      tenantId: "t1",
      tenantName: "Tenant 1",
      slug: "t1",
      userId: "u1",
      userName: "User 1",
    });
    expect(tx.membership.createMany).toHaveBeenCalled();
  });
});
