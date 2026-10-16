import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const authMock = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const queryRawMock = vi.mocked(prisma.$queryRaw) as unknown as ReturnType<typeof vi.fn>;
const findUniqueMock = vi.mocked(prisma.user.findUnique) as unknown as ReturnType<typeof vi.fn>;

describe("/api/health GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("anonymous / public requests", () => {
    it("returns 200 ok when database is reachable", async () => {
      authMock.mockResolvedValue(null);
      queryRawMock.mockResolvedValue([{ "?column?": 1 }]);

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ status: "ok" });
      expect(queryRawMock).toHaveBeenCalled();
    });

    it("returns 503 degraded when database is down", async () => {
      authMock.mockResolvedValue(null);
      queryRawMock.mockRejectedValue(new Error("Connection refused"));

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await GET(req);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual({ status: "degraded" });
    });

    it("handles auth database errors gracefully and returns 503 degraded", async () => {
      authMock.mockRejectedValue(new Error("DB connection error"));
      queryRawMock.mockRejectedValue(new Error("Connection refused"));

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await GET(req);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual({ status: "degraded" });
    });
  });

  describe("super admin requests", () => {
    it("returns 200 healthy when database and columns are healthy", async () => {
      authMock.mockResolvedValue({
        user: { id: "admin-1", email: "admin@example.com" },
      } as Session);
      findUniqueMock.mockResolvedValue({
        role: "super_admin",
        email: "admin@example.com",
      });
      queryRawMock.mockImplementation(async (strings: unknown) => {
        const query = Array.isArray(strings) ? strings.join("") : String(strings);
        if (query.includes("information_schema")) {
          return [
            { table_name: "User", column_name: "role" },
            { table_name: "User", column_name: "passwordHash" },
            { table_name: "User", column_name: "emailVerified" },
            { table_name: "Vote", column_name: "value" },
            { table_name: "Vote", column_name: "userId" },
            { table_name: "Vote", column_name: "bugId" },
            { table_name: "Bug", column_name: "proofLinks" },
            { table_name: "Bug", column_name: "voteCount" },
            { table_name: "BugActivity", column_name: "type" },
            { table_name: "BugActivity", column_name: "summary" },
            { table_name: "Comment", column_name: "parentId" },
          ];
        }
        return [{ "?column?": 1 }];
      });

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.db).toBe(true);
      expect(data.schemaSynced).toBe(true);
    });

    it("returns 503 degraded when database query fails", async () => {
      authMock.mockResolvedValue({
        user: { id: "admin-1", email: "admin@example.com" },
      } as Session);
      findUniqueMock.mockResolvedValue({
        role: "super_admin",
        email: "admin@example.com",
      });
      queryRawMock.mockRejectedValue(new Error("Connection refused"));

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await GET(req);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.status).toBe("degraded");
      expect(data.db).toBe(false);
    });
  });
});
