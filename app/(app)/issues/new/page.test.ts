import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(async () => ({ id: "u1", role: "user" })),
}));

vi.mock("@/lib/tenant-context", () => ({
  currentTenantIdFor: vi.fn(async () => "tenant-ziki"),
}));

vi.mock("@/lib/lookups", () => ({
  getActivePlatforms: vi.fn(),
  getActiveIssueTypesCached: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/components/create-issue-form", () => ({
  CreateIssueForm: () => null,
}));

import { CreateIssueForm } from "@/components/create-issue-form";
import { getActiveIssueTypesCached, getActivePlatforms } from "@/lib/lookups";
import { prisma } from "@/lib/prisma";
import NewBugPage from "./page";

function formProps(node: ReactNode): Record<string, unknown> | undefined {
  if (!node || typeof node !== "object") return;
  if ("type" in node && node.type === CreateIssueForm) {
    return (node as { props: Record<string, unknown> }).props;
  }
  const children =
    "props" in node ? (node as { props: { children?: ReactNode } }).props.children : undefined;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = formProps(child);
    if (found) return found;
  }
}

const people = [{ id: "u1", name: "Ada", role: "user", image: null }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findMany).mockResolvedValue(people as never);
  vi.mocked(getActivePlatforms).mockResolvedValue([{ id: "c1", name: "Web" }]);
  vi.mocked(getActiveIssueTypesCached).mockResolvedValue([]);
});

describe("report form lookups", () => {
  it("still renders when platforms and issue types fail", async () => {
    vi.mocked(getActivePlatforms).mockRejectedValue(new Error("The column `template` does not exist"));
    vi.mocked(getActiveIssueTypesCached).mockRejectedValue(new Error("lookup down"));

    const page = await NewBugPage();

    expect(formProps(page)).toMatchObject({
      users: people,
      categories: [],
      types: [],
      currentUserId: "u1",
    });
  });

  it("retries people without image when that column is missing", async () => {
    vi.mocked(prisma.user.findMany)
      .mockRejectedValueOnce(new Error("The column `User.image` does not exist in the current database."))
      .mockResolvedValueOnce([{ id: "u1", name: "Ada", role: "user" }] as never);

    const page = await NewBugPage();

    expect(prisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ select: { id: true, name: true, role: true } }),
    );
    expect(formProps(page)).toMatchObject({
      users: [{ id: "u1", name: "Ada", role: "user", image: null }],
      categories: [{ id: "c1", name: "Web" }],
    });
    expect(getActivePlatforms).toHaveBeenCalledWith("tenant-ziki");
  });
});
