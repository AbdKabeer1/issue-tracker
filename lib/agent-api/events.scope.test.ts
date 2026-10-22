import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { bug: { findFirst } } }));

import { AgentProjectError } from "@/lib/agents/require-agent";
import { scopeEventFilters, type EventFilters } from "./events";

const scoped = { tenantId: "tenant-a", projectId: "proj-ziki", projectSlug: "ziki" };
const legacy = { tenantId: "tenant-a", projectId: null as string | null, projectSlug: null as string | null };

describe("scopeEventFilters project scope (#405)", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("passes a legacy key's filters through untouched", async () => {
    const filters: EventFilters = { projectId: "proj-web", bugId: "issue-1" };
    await expect(scopeEventFilters(legacy, filters)).resolves.toEqual({ filters });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects a foreign projectId and a same-tenant foreign bugId with AgentProjectError", async () => {
    await expect(scopeEventFilters(scoped, { projectId: "proj-web" })).rejects.toBeInstanceOf(AgentProjectError);
    findFirst.mockResolvedValue({ projectId: "proj-web" });
    await expect(scopeEventFilters(scoped, { bugId: "issue-web" })).rejects.toBeInstanceOf(AgentProjectError);
    await expect(scopeEventFilters(scoped, { projectId: "proj-ziki", bugId: "issue-web" })).rejects.toBeInstanceOf(AgentProjectError);
  });

  it("answers 404 for a bugId that does not exist or belongs to another tenant", async () => {
    findFirst.mockResolvedValue(null);
    await expect(scopeEventFilters(scoped, { bugId: "issue-missing" })).resolves.toEqual({ status: 404, error: "Issue not found." });
    await expect(scopeEventFilters(scoped, { bugId: "issue-other-tenant" })).resolves.toEqual({ status: 404, error: "Issue not found." });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "issue-other-tenant", tenantId: "tenant-a" }, select: { projectId: true } });
  });

  it("accepts its own project and filters unfiltered polls to it", async () => {
    findFirst.mockResolvedValue({ projectId: "proj-ziki" });
    await expect(scopeEventFilters(scoped, {})).resolves.toEqual({ filters: { projectId: "proj-ziki" } });
    await expect(scopeEventFilters(scoped, { projectId: "proj-ziki", bugId: "issue-ziki" })).resolves.toEqual({
      filters: { projectId: "proj-ziki", bugId: "issue-ziki" },
    });
    await expect(scopeEventFilters(scoped, { bugId: "issue-ziki" })).resolves.toEqual({
      filters: { bugId: "issue-ziki", projectId: "proj-ziki" },
    });
  });
});
