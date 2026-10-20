import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const currentTenantIdFor = vi.hoisted(() => vi.fn());
const isTenantAdmin = vi.hoisted(() => vi.fn());
const cookieGet = vi.hoisted(() => vi.fn());
const cookieDelete = vi.hoisted(() => vi.fn());
const projectFindFirst = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet, delete: cookieDelete }) }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor }));
vi.mock("@/lib/agents/membership", () => ({ isTenantAdmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    $transaction: transaction,
  },
}));

import { GET } from "./route";

const callback = (query: string) => new NextRequest(`http://localhost/projects/github/callback?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", role: "user" });
  currentTenantIdFor.mockResolvedValue("tenant-1");
  isTenantAdmin.mockResolvedValue(true);
  cookieGet.mockReturnValue({ value: "web.random-state" });
  projectFindFirst.mockResolvedValue({ id: "project-1", githubInstallationId: null });
  transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
    work({ project: { update }, projectAuditEvent: { create: audit } }),
  );
});

describe("GitHub App project callback (#608)", () => {
  it("rejects a missing or mismatched one-time state before writing", async () => {
    const response = await GET(callback("installation_id=123&state=forged&setup_action=install"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("github=error");
    expect(cookieDelete).toHaveBeenCalledWith("ziki_github_install_state");
    expect(requireUser).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("saves and audits the installation for the authorized project owner", async () => {
    const response = await GET(callback("installation_id=12345&state=web.random-state&setup_action=install"));
    expect(response.headers.get("location")).toContain("/projects/web/settings?github=connected");
    expect(projectFindFirst).toHaveBeenCalledWith({ where: { tenantId: "tenant-1", slug: "web" }, select: { id: true, githubInstallationId: true } });
    expect(update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: { githubInstallationId: "12345" } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "user-1", action: "github.installation.connected" }) }));
  });

  it("does not connect an installation for a workspace member", async () => {
    isTenantAdmin.mockResolvedValue(false);
    const response = await GET(callback("installation_id=12345&state=web.random-state&setup_action=install"));
    expect(response.headers.get("location")).toBe("http://localhost/issues");
    expect(projectFindFirst).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
