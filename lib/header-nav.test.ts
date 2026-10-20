import { describe, expect, it } from "vitest";
import {
  SWITCH_TENANT_LINK,
  headerNavItems,
  initialsOf,
  isNavItemActive,
  realRoleOf,
} from "./header-nav";

describe("SWITCH_TENANT_LINK (#444)", () => {
  it("goes to the tenant picker, and is marked current on it and its pages", () => {
    expect(SWITCH_TENANT_LINK).toEqual({ href: "/tenants", label: "Switch tenant" });
    expect(isNavItemActive("/tenants", SWITCH_TENANT_LINK.href)).toBe(true);
    expect(isNavItemActive("/tenants/acme", SWITCH_TENANT_LINK.href)).toBe(true);
    expect(isNavItemActive("/issues", SWITCH_TENANT_LINK.href)).toBe(false);
  });

  it("stays out of the main nav, which is unchanged", () => {
    for (const role of ["user", "admin", "super_admin"] as const) {
      expect(headerNavItems(role).map((i) => i.href)).not.toContain("/tenants");
    }
  });
});

describe("headerNavItems", () => {
  it("shows Issues, Projects, Milestones, Escalations, and Redesigns to normal users by default", () => {
    expect(headerNavItems("user").map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
      "Escalations",
      "Redesigns",
    ]);
  });

  it("shows only Issues, Projects, and Milestones when agent platform is explicitly disabled", () => {
    expect(headerNavItems("user", { agentPlatform: false }).map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
    ]);
  });

  it("includes Escalations and Redesigns when agent platform is enabled (#627)", () => {
    expect(headerNavItems("user", { agentPlatform: true }).map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
      "Escalations",
      "Redesigns",
    ]);
  });

  it("includes pending escalations badge count when provided (#763)", () => {
    const items = headerNavItems("user", { agentPlatform: true, pendingEscalations: 3 });
    const escalationsItem = items.find((i) => i.href === "/escalations");
    expect(escalationsItem?.badge).toBe(3);

    const zeroItems = headerNavItems("user", { agentPlatform: true, pendingEscalations: 0 });
    expect(zeroItems.find((i) => i.href === "/escalations")?.badge).toBeUndefined();
  });

  it("adds Platforms and Types for admins", () => {
    expect(headerNavItems("admin").map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
      "Escalations",
      "Redesigns",
      "Platforms",
      "Types",
    ]);
  });

  it("shows Platforms to an organization owner who is not a site admin", () => {
    expect(headerNavItems("user", { managePlatforms: true }).map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
      "Escalations",
      "Redesigns",
      "Platforms",
    ]);
  });

  it("adds Admins for super admins", () => {
    expect(headerNavItems("super_admin").map((i) => i.label)).toEqual([
      "Issues",
      "Projects",
      "Milestones",
      "Escalations",
      "Redesigns",
      "Platforms",
      "Types",
      "Admins",
    ]);
  });
});

describe("isNavItemActive", () => {
  it("marks Issues active on the list and on an issue, not on the new-issue form", () => {
    expect(isNavItemActive("/issues", "/issues")).toBe(true);
    expect(isNavItemActive("/issues/", "/issues")).toBe(true);
    expect(isNavItemActive("/issues/abc123", "/issues")).toBe(true);
    expect(isNavItemActive("/issues/new", "/issues")).toBe(false);
    expect(isNavItemActive("/bugs", "/issues")).toBe(true);
    expect(isNavItemActive("/bugs/abc123", "/issues")).toBe(true);
  });

  it("matches admin pages by prefix only on a path boundary", () => {
    expect(isNavItemActive("/admin/types", "/admin/types")).toBe(true);
    expect(isNavItemActive("/admin/types/x", "/admin/types")).toBe(true);
    expect(isNavItemActive("/admin/typesx", "/admin/types")).toBe(false);
    expect(isNavItemActive("/settings", "/admin/types")).toBe(false);
    expect(isNavItemActive(null, "/issues")).toBe(false);
  });

  it("marks Escalations active for /escalations and legacy /questions (#763)", () => {
    expect(isNavItemActive("/escalations", "/escalations")).toBe(true);
    expect(isNavItemActive("/escalations/q1", "/escalations")).toBe(true);
    expect(isNavItemActive("/questions", "/escalations")).toBe(true);
    expect(isNavItemActive("/questions/q1", "/escalations")).toBe(true);
    expect(isNavItemActive("/issues", "/escalations")).toBe(false);
  });
});

describe("realRoleOf", () => {
  it("ignores the View as override", () => {
    expect(realRoleOf({ isRealSuperAdmin: true, isRealAdmin: true })).toBe("super_admin");
    expect(realRoleOf({ isRealAdmin: true })).toBe("admin");
    expect(realRoleOf({})).toBe("user");
  });
});

describe("initialsOf", () => {
  it("builds up to two initials", () => {
    expect(initialsOf("Bob Builder")).toBe("BB");
    expect(initialsOf("Alice Mentor Smith")).toBe("AS");
    expect(initialsOf("cara")).toBe("CA");
    expect(initialsOf("jane.doe@zedu.chat")).toBe("JD");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});
