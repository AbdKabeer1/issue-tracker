import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
const currentTenantIdFor = vi.hoisted(() => vi.fn());
const cookieGet = vi.hoisted(() => vi.fn());
const cookieSet = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const isTenantAdmin = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: cookieSet }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/agents/membership", () => ({ isTenantAdmin }));
vi.mock("@/lib/tenant-context", () => ({
  currentTenantIdFor,
  NO_TENANT_MESSAGE: "You're not a member of a workspace yet.",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
    projectAuditEvent: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/project-context";
import { createProjectAction, switchProjectAction, updateProjectAction } from "./actions";

const findMany = vi.mocked(prisma.project.findMany) as unknown as ReturnType<typeof vi.fn>;
const create = vi.mocked(prisma.project.create) as unknown as ReturnType<typeof vi.fn>;
const findFirst = vi.mocked(prisma.project.findFirst) as unknown as ReturnType<typeof vi.fn>;

const REDIRECT = new Error("NEXT_REDIRECT");
redirect.mockImplementation(() => {
  throw REDIRECT;
});

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function expectRedirect(promise: Promise<unknown>) {
  await expect(promise).rejects.toBe(REDIRECT);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", role: "user" });
  currentTenantIdFor.mockResolvedValue("tenant-zedu");
  findMany.mockResolvedValue([{ slug: "zedu" }]);
  create.mockResolvedValue({ id: "project-new" });
  findFirst.mockResolvedValue({ id: "project-zedu" });
  isTenantAdmin.mockResolvedValue(true);
  cookieGet.mockReturnValue(undefined);
});

describe("createProjectAction (#426)", () => {
  it("creates a project in the current tenant and makes it active", async () => {
    await expectRedirect(
      createProjectAction(undefined, form({ name: "  Zedu Web  " })),
    );

    expect(create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-zedu", name: "Zedu Web", slug: "zedu-web" },
      select: { id: true },
    });
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVE_PROJECT_COOKIE,
      "project-new",
      expect.objectContaining({ path: "/", httpOnly: true }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/issues");
  });

  it("adds a suffix instead of failing on a duplicate slug", async () => {
    findMany.mockResolvedValue([{ slug: "zedu-web" }]);

    await expectRedirect(createProjectAction(undefined, form({ name: "Zedu Web" })));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "zedu-web-2" }),
      }),
    );
  });

  it("rejects a blank name without writing", async () => {
    const result = await createProjectAction(undefined, form({ name: "   " }));

    expect(result.error).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("does nothing for someone without a workspace", async () => {
    currentTenantIdFor.mockResolvedValue(null);

    const result = await createProjectAction(undefined, form({ name: "Zedu Web" }));

    expect(result.error).toBe("You're not a member of a workspace yet.");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("switchProjectAction (#426)", () => {
  it("stores the project and returns to the scoped issue list", async () => {
    await expectRedirect(switchProjectAction(form({ projectId: "project-zedu" })));

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "project-zedu", tenantId: "tenant-zedu" },
      select: { id: true },
    });
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVE_PROJECT_COOKIE,
      "project-zedu",
      expect.objectContaining({ path: "/", httpOnly: true }),
    );
    expect(redirect).toHaveBeenCalledWith("/issues");
  });

  it("ignores another tenant's project without setting the cookie", async () => {
    findFirst.mockResolvedValue(null);

    await switchProjectAction(form({ projectId: "project-other" }));

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("requires a project id", async () => {
    await switchProjectAction(form({}));

    expect(findFirst).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe("updateProjectAction (#608)", () => {
  it("updates settings and records the change with the actor", async () => {
    findFirst.mockResolvedValue({ id: "project-zedu", name: "Web", goal: null, repoUrl: null, stagingUrl: null });
    const update = vi.fn();
    const audit = vi.fn();
    const transaction = vi.mocked(prisma.$transaction) as unknown as ReturnType<typeof vi.fn>;
    transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) =>
      work({ project: { update }, projectAuditEvent: { create: audit } }),
    );
    const result = await updateProjectAction(undefined, form({ slug: "web", name: "Web App", goal: "Ship", repoUrl: "https://github.com/acme/web", stagingUrl: "https://staging.example.com" }));
    expect(result).toEqual({});
    expect(update).toHaveBeenCalledWith({ where: { id: "project-zedu" }, data: { name: "Web App", goal: "Ship", repoUrl: "https://github.com/acme/web", stagingUrl: "https://staging.example.com" } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-zedu", projectId: "project-zedu", actorUserId: "user-1", action: "settings.updated" }) }));
    expect(revalidatePath).toHaveBeenCalledWith("/projects/web/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/issues");
  });

  it("refuses members and invalid URLs without writing", async () => {
    isTenantAdmin.mockResolvedValue(false);
    expect(await updateProjectAction(undefined, form({ slug: "web", name: "Web", goal: "", repoUrl: "https://evil.example/repo", stagingUrl: "http://staging.example.com" }))).toMatchObject({ error: expect.any(String) });
    expect(findFirst).not.toHaveBeenCalled();
    isTenantAdmin.mockResolvedValue(true);
    const invalid = await updateProjectAction(undefined, form({ slug: "web", name: "Web", goal: "", repoUrl: "https://evil.example/repo", stagingUrl: "http://staging.example.com" }));
    expect(invalid.fieldErrors).toMatchObject({ repoUrl: expect.any(String), stagingUrl: expect.any(String) });
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
  });
});
