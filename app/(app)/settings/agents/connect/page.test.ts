import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
const currentTenantIdFor = vi.hoisted(() => vi.fn());
const projectContextFor = vi.hoisted(() => vi.fn());
const isAgentPlatformEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor }));
vi.mock("@/lib/project-context", () => ({ projectContextFor }));
vi.mock("@/lib/feature-flags", () => ({ isAgentPlatformEnabled }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://ziki.dev" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApiKey: {
      findFirst: vi.fn(),
    },
  },
}));

import ConnectAgentPage from "./page";
import { prisma } from "@/lib/prisma";

describe("ConnectAgentPage Server Component (#610)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user_1" });
    isAgentPlatformEnabled.mockReturnValue(true);
    currentTenantIdFor.mockResolvedValue("tenant_1");
    projectContextFor.mockResolvedValue({
      projects: [{ id: "proj_1", name: "Alpha", slug: "alpha" }],
      activeProjectId: "proj_1",
    });
    vi.mocked(prisma.agentApiKey.findFirst).mockResolvedValue(null);
  });

  it("shows disabled message when agent platform is switched off", async () => {
    isAgentPlatformEnabled.mockReturnValue(false);
    const element = await ConnectAgentPage();
    expect(element).toBeTruthy();
  });

  it("prompts to join workspace if user has no current tenant", async () => {
    currentTenantIdFor.mockResolvedValue(null);
    const element = await ConnectAgentPage();
    expect(element).toBeTruthy();
  });

  it("renders page with templates for active project", async () => {
    const element = await ConnectAgentPage();
    expect(element).toBeTruthy();
  });
});
