import { beforeEach, describe, expect, it, vi } from "vitest";

/** The RBAC gate every page and action goes through (#218). */

const redirectError = (to: string) => Object.assign(new Error("NEXT_REDIRECT"), { to });
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw redirectError(to);
  }),
}));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) })),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { ACTIVE_ROLE_COOKIE_NAME } from "@/lib/roles";
import { requireAdmin, requireSuperAdmin, requireUser } from "./auth-helpers";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockResolve = resolveSessionUserId as unknown as ReturnType<typeof vi.fn>;
const findUser = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

function signedInAs(role: "user" | "admin" | "super_admin", email = `${role}@zedu.test`) {
  mockAuth.mockResolvedValue({ user: { id: "u1", email } });
  mockResolve.mockResolvedValue({ userId: "u1" });
  findUser.mockResolvedValue({ id: "u1", name: "U", email, image: null, role });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  vi.stubEnv("SUPER_ADMIN_EMAIL", "");
  vi.stubEnv("SUPER_ADMIN_EMAILS", "");
});

describe("requireUser", () => {
  it("redirects to /login without a session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ to: "/login" });
  });

  it("returns the database role, not the JWT's", async () => {
    signedInAs("admin");
    await expect(requireUser()).resolves.toMatchObject({ id: "u1", role: "admin", isRealAdmin: true });
  });

  it("applies a View as override only for real admins", async () => {
    cookieJar.set(ACTIVE_ROLE_COOKIE_NAME, "user:u1");
    signedInAs("admin");
    await expect(requireUser()).resolves.toMatchObject({ role: "user", isRealAdmin: true });

    cookieJar.set(ACTIVE_ROLE_COOKIE_NAME, "admin:u1");
    signedInAs("user");
    await expect(requireUser()).resolves.toMatchObject({ role: "user", isRealAdmin: false });
  });
});

describe("requireAdmin / requireSuperAdmin", () => {
  it.each([
    ["user", false, false],
    ["admin", true, false],
    ["super_admin", true, true],
  ] as const)("%s → admin pages %s, super-admin pages %s", async (role, admin, superAdmin) => {
    signedInAs(role);
    const adminGate = requireAdmin();
    if (admin) await expect(adminGate).resolves.toMatchObject({ role });
    else await expect(adminGate).rejects.toMatchObject({ to: "/bugs" });

    signedInAs(role);
    const superGate = requireSuperAdmin();
    if (superAdmin) await expect(superGate).resolves.toMatchObject({ role });
    else await expect(superGate).rejects.toMatchObject({ to: "/bugs" });
  });

  it("treats an admin previewing as a normal user as a normal user", async () => {
    cookieJar.set(ACTIVE_ROLE_COOKIE_NAME, "user:u1");
    signedInAs("admin");
    await expect(requireAdmin()).rejects.toMatchObject({ to: "/bugs" });
  });
});
