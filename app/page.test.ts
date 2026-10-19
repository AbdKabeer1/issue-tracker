import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolveSessionUserId: vi.fn(),
  homePathFor: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  }),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: mocks.resolveSessionUserId }));
vi.mock("@/lib/tenants", () => ({ homePathFor: mocks.homePathFor }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import HomePage from "./page";

async function landing(): Promise<string> {
  try {
    await HomePage();
  } catch (error) {
    return (error as { path: string }).path;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("home redirect (#444)", () => {
  it("sends a signed-out visitor to sign in", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await landing()).toBe("/login");
    expect(mocks.homePathFor).not.toHaveBeenCalled();
  });

  it("sends a signed-in person where their tenants say: the list or the picker", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "ada" } });
    mocks.resolveSessionUserId.mockResolvedValue({ userId: "ada" });

    mocks.homePathFor.mockResolvedValue("/issues");
    expect(await landing()).toBe("/issues");
    mocks.homePathFor.mockResolvedValue("/tenants");
    expect(await landing()).toBe("/tenants");
    expect(mocks.homePathFor).toHaveBeenCalledWith({}, "ada");
  });

  it("leaves a session it can't resolve to the issue list's own checks", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "stale" } });
    mocks.resolveSessionUserId.mockResolvedValue({ error: "Session expired, sign in again" });
    expect(await landing()).toBe("/issues");
    expect(mocks.homePathFor).not.toHaveBeenCalled();
  });
});
