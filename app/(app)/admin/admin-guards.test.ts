import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Middleware no longer checks roles for /admin (its JWT role goes stale, #121),
 * so each admin page must enforce the role itself from the database.
 */
const adminDir = path.resolve(__dirname);

function adminPages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return adminPages(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

describe("admin page guards (#121)", () => {
  const pages = adminPages(adminDir);

  it("finds the admin pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages.map((page) => [path.relative(adminDir, page), page]))(
    "%s checks the role server-side",
    (_name, page) => {
      expect(readFileSync(page, "utf8")).toMatch(
        /require(Super)?Admin\(\)/,
      );
    },
  );

  it("limits /admin/users to super admins", () => {
    const users = readFileSync(path.join(adminDir, "users", "page.tsx"), "utf8");
    expect(users).toMatch(/requireSuperAdmin\(\)/);
  });
});
