import { describe, expect, it } from "vitest";
import {
  headerNavItems,
  initialsOf,
  isNavItemActive,
  realRoleOf,
} from "./header-nav";

describe("headerNavItems", () => {
  it("shows only Issues to normal users", () => {
    expect(headerNavItems("user").map((i) => i.label)).toEqual(["Issues"]);
  });

  it("adds Platforms and Types for admins", () => {
    expect(headerNavItems("admin").map((i) => i.label)).toEqual([
      "Issues",
      "Platforms",
      "Types",
    ]);
  });

  it("adds Admins for super admins", () => {
    expect(headerNavItems("super_admin").map((i) => i.label)).toEqual([
      "Issues",
      "Platforms",
      "Types",
      "Admins",
    ]);
  });
});

describe("isNavItemActive", () => {
  it("marks Issues active on the list and on an issue, not on the new-issue form", () => {
    expect(isNavItemActive("/bugs", "/bugs")).toBe(true);
    expect(isNavItemActive("/bugs/", "/bugs")).toBe(true);
    expect(isNavItemActive("/bugs/abc123", "/bugs")).toBe(true);
    expect(isNavItemActive("/bugs/new", "/bugs")).toBe(false);
  });

  it("matches admin pages by prefix only on a path boundary", () => {
    expect(isNavItemActive("/admin/types", "/admin/types")).toBe(true);
    expect(isNavItemActive("/admin/types/x", "/admin/types")).toBe(true);
    expect(isNavItemActive("/admin/typesx", "/admin/types")).toBe(false);
    expect(isNavItemActive("/settings", "/admin/types")).toBe(false);
    expect(isNavItemActive(null, "/bugs")).toBe(false);
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
