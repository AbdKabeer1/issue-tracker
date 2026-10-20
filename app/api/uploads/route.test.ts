import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  RATE_LIMIT_MESSAGE: "Too many uploads. Slow down.",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    attachment: {
      create: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
  },
}));

import { resolveSessionUserId } from "@/lib/session-user";
import { consumeRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const session = vi.mocked(resolveSessionUserId) as unknown as ReturnType<typeof vi.fn>;
const limit = vi.mocked(consumeRateLimit) as unknown as ReturnType<typeof vi.fn>;
const create = vi.mocked(prisma.attachment.create) as unknown as ReturnType<typeof vi.fn>;

function makeUploadRequest(file?: File | string | null) {
  const formData = new FormData();
  if (file !== undefined && file !== null) {
    formData.append("file", file as unknown as Blob);
  }
  return new NextRequest("http://localhost:3000/api/uploads", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.mockResolvedValue({ userId: "u1" });
    limit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  it("returns 401 when unauthenticated", async () => {
    session.mockResolvedValue({ error: "Unauthorized" });
    const req = makeUploadRequest(new File(["content"], "test.txt", { type: "text/plain" }));
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to upload files." });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit exceeded", async () => {
    limit.mockResolvedValue({ allowed: false, retryAfterMs: 5000 });
    const req = makeUploadRequest(new File(["content"], "test.txt", { type: "text/plain" }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many uploads. Slow down." });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is uploaded", async () => {
    const req = makeUploadRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Choose a file to upload." });
  });

  it("returns 400 when file content is invalid/disallowed (e.g. HTML)", async () => {
    const htmlFile = new File(["<script>alert(1)</script>"], "bad.html", { type: "text/html" });
    const req = makeUploadRequest(htmlFile);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 201 and creates attachment when file is valid", async () => {
    const validText = new File(["hello logs content"], "debug.log", { type: "text/plain" });
    create.mockResolvedValue({
      id: "att-123",
      filename: "debug.log",
      contentType: "text/plain; charset=utf-8",
      size: 18,
    });

    const req = makeUploadRequest(validText);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toEqual({
      id: "att-123",
      filename: "debug.log",
      contentType: "text/plain; charset=utf-8",
      size: 18,
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        uploaderId: "u1",
        filename: "debug.log",
        contentType: "text/plain; charset=utf-8",
        size: 18,
        data: expect.any(Buffer),
      },
      select: { id: true, filename: true, contentType: true, size: true },
    });
  });

  it("clears this person's expired, never-attached uploads after a successful upload (#543)", async () => {
    create.mockResolvedValue({ id: "a1", filename: "shot.png", contentType: "image/png", size: 8 });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "shot.png", { type: "image/png" });
    const response = await POST(makeUploadRequest(png));
    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.attachment.deleteMany)).toHaveBeenCalledWith({
      where: expect.objectContaining({ uploaderId: "u1", bugId: null, commentId: null, redesignProposalId: null }),
    });
  });

  it("still returns the upload when the cleanup fails", async () => {
    create.mockResolvedValue({ id: "a2", filename: "shot.png", contentType: "image/png", size: 8 });
    vi.mocked(prisma.attachment.deleteMany).mockRejectedValueOnce(new Error("db hiccup"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "shot.png", { type: "image/png" });
    expect((await POST(makeUploadRequest(png))).status).toBe(201);
    expect(log).toHaveBeenCalledWith("[uploads] cleanup of unlinked uploads failed", expect.any(Error));
    log.mockRestore();
  });
});
