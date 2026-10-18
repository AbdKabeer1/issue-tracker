import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attachment: {
      findUnique: vi.fn(),
    },
  },
}));

import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const userMock = vi.mocked(requireUser) as unknown as ReturnType<typeof vi.fn>;
const findUnique = vi.mocked(prisma.attachment.findUnique) as unknown as ReturnType<typeof vi.fn>;

function makeRequest(id: string) {
  return GET(new NextRequest(`http://localhost:3000/api/attachments/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/attachments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMock.mockResolvedValue({ id: "user-1", role: "user" });
  });

  it("returns 404 if attachment is not found", async () => {
    findUnique.mockResolvedValue(null);
    const res = await makeRequest("missing-id");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "File not found" });
  });

  it("returns 404 if attachment is unlinked and uploader is someone else", async () => {
    findUnique.mockResolvedValue({
      uploaderId: "user-2",
      filename: "secret.pdf",
      contentType: "application/pdf",
      size: 100,
      data: Buffer.from("pdf-data"),
      bug: null,
    });
    const res = await makeRequest("att-1");
    expect(res.status).toBe(404);
  });

  it("returns 200 if attachment is unlinked but uploader is current user", async () => {
    findUnique.mockResolvedValue({
      uploaderId: "user-1",
      filename: "my-draft.log",
      contentType: "text/plain; charset=utf-8",
      size: 10,
      data: Buffer.from("log-content"),
      bug: null,
    });
    const res = await makeRequest("att-1");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("log-content");
    expect(res.headers.get("Content-Disposition")).toContain('filename="my-draft.log"');
  });

  it("returns 404 if attachment belongs to a deleted issue and user is not admin", async () => {
    userMock.mockResolvedValue({ id: "user-1", role: "user" });
    findUnique.mockResolvedValue({
      uploaderId: "user-1",
      filename: "issue.png",
      contentType: "image/png",
      size: 50,
      data: Buffer.from("png-bytes"),
      bug: { isDeleted: true },
    });
    const res = await makeRequest("att-2");
    expect(res.status).toBe(404);
  });

  it("returns 200 if attachment belongs to a deleted issue and user is an admin", async () => {
    userMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    findUnique.mockResolvedValue({
      uploaderId: "user-2",
      filename: "issue.png",
      contentType: "image/png",
      size: 50,
      data: Buffer.from("png-bytes"),
      bug: { isDeleted: true },
    });
    const res = await makeRequest("att-2");
    expect(res.status).toBe(200);
  });

  it("returns 200 for normal user if attachment belongs to an active issue", async () => {
    userMock.mockResolvedValue({ id: "user-3", role: "user" });
    findUnique.mockResolvedValue({
      uploaderId: "user-2",
      filename: "screenshot.webp",
      contentType: "image/webp",
      size: 100,
      data: Buffer.from("webp-bytes"),
      bug: { isDeleted: false },
    });
    const res = await makeRequest("att-3");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });
});
