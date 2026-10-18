import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/lookups", () => ({
  getIssueTypes: vi.fn().mockResolvedValue([]),
  getPlatforms: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    milestone: { findMany: vi.fn().mockResolvedValue([]) },
    bug: {
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

import { auth } from "@/auth";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const authMock = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const requireUserMock = vi.mocked(requireUser) as unknown as ReturnType<typeof vi.fn>;
const findManyBugs = vi.mocked(prisma.bug.findMany) as unknown as ReturnType<typeof vi.fn>;

describe("GET /issues/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    requireUserMock.mockResolvedValue({ id: "u1", role: "user" });
    findManyBugs.mockResolvedValue([]);
  });

  it("returns 401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/issues/export");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Not signed in" });
  });

  it("returns CSV response with proper headers when signed in", async () => {
    const req = new NextRequest("http://localhost:3000/issues/export");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain('attachment; filename="zedu-issues-');
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const text = await res.text();
    // Headers row
    expect(text).toContain("id,title,status,severity,type,platform,reporter,assignee,votes,boosted,created_at,updated_at");
  });

  it("streams rows matching query", async () => {
    findManyBugs.mockResolvedValueOnce([
      {
        id: "bug-1",
        title: "Button broken",
        status: "open",
        severity: "high",
        voteCount: 5,
        isBoosted: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        type: { name: "Bug" },
        category: { name: "Web" },
        reporter: { name: "Alice" },
        assignee: { name: "Bob" },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/issues/export?status=open");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("bug-1,Button broken,Open,High,Bug,Web,Alice,Bob,5,false");
  });
});
