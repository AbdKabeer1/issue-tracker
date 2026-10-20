import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteCookieMock } = vi.hoisted(() => ({
  deleteCookieMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    delete: deleteCookieMock,
  }),
}));

vi.mock("@/auth", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "@/auth";
import { ACTIVE_ROLE_COOKIE_NAME } from "@/lib/roles";
import { GET } from "./route";

const signOutMock = vi.mocked(signOut) as unknown as ReturnType<typeof vi.fn>;

describe("GET /session-expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes active role cookie and signs out with expired redirect", async () => {
    await GET();

    expect(deleteCookieMock).toHaveBeenCalledWith(ACTIVE_ROLE_COOKIE_NAME);
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login?expired=1" });
  });
});
