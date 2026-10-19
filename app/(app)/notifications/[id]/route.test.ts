import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/lookups", () => ({
  expireTag: vi.fn(),
  TAGS: { unread: (id: string) => `unread:${id}` },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { resolveSessionUserId } from "@/lib/session-user";
import { expireTag } from "@/lib/lookups";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const sessionUser = vi.mocked(resolveSessionUserId) as unknown as ReturnType<typeof vi.fn>;
const findUnique = vi.mocked(prisma.notification.findUnique) as unknown as ReturnType<typeof vi.fn>;
const update = vi.mocked(prisma.notification.update) as unknown as ReturnType<typeof vi.fn>;
const expireTagMock = vi.mocked(expireTag) as unknown as ReturnType<typeof vi.fn>;

function makeRequest(id: string) {
  return GET(new NextRequest(`http://localhost:3000/notifications/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /notifications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser.mockResolvedValue({ userId: "u1" });
  });

  it("redirects to /login if user is not signed in", async () => {
    sessionUser.mockResolvedValue({ error: "Unauthorized" });
    const res = await makeRequest("notif-1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("redirects to /notifications if notification does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const res = await makeRequest("missing-notif");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/notifications");
    expect(update).not.toHaveBeenCalled();
  });

  it("redirects to /notifications if notification belongs to someone else", async () => {
    findUnique.mockResolvedValue({
      userId: "u2",
      url: "/issues/bug-1",
      readAt: null,
    });
    const res = await makeRequest("notif-other");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/notifications");
    expect(update).not.toHaveBeenCalled();
  });

  it("marks unread notification as read, expires tag, and redirects to target URL", async () => {
    findUnique.mockResolvedValue({
      userId: "u1",
      url: "/issues/bug-42#comment-9",
      readAt: null,
    });
    const res = await makeRequest("notif-1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/issues/bug-42#comment-9");
    expect(update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { readAt: expect.any(Date) },
    });
    expect(expireTagMock).toHaveBeenCalledWith("unread:u1");
  });

  it("does not re-update if notification was already read", async () => {
    findUnique.mockResolvedValue({
      userId: "u1",
      url: "/issues/bug-42",
      readAt: new Date("2026-01-01T00:00:00Z"),
    });
    const res = await makeRequest("notif-1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/issues/bug-42");
    expect(update).not.toHaveBeenCalled();
    expect(expireTagMock).not.toHaveBeenCalled();
  });
});
