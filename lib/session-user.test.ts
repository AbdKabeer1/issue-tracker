import { beforeEach, describe, expect, it, vi } from "vitest";

/** Session-version checking and the id re-resolution fallback (#208). */

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  SESSION_EXPIRED_MESSAGE,
  isSessionVersionCurrent,
  resolveSessionUserId,
} from "./session-user";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

const session = (user: Record<string, unknown> | null) =>
  mockAuth.mockResolvedValue(user ? { user } : null);

describe("isSessionVersionCurrent", () => {
  it("matches when the versions are equal", () => {
    expect(isSessionVersionCurrent(3, 3)).toBe(true);
  });

  it("does not match once the user's version has moved on", () => {
    expect(isSessionVersionCurrent(2, 3)).toBe(false);
  });

  it("treats a session issued before versions existed as version 0", () => {
    // Nobody should be signed out by the deploy itself, only by a reset.
    expect(isSessionVersionCurrent(undefined, 0)).toBe(true);
    expect(isSessionVersionCurrent(null, 0)).toBe(true);
    expect(isSessionVersionCurrent(undefined, 1)).toBe(false);
  });
});

describe("resolveSessionUserId", () => {
  it("returns the id when the session matches a current user", async () => {
    session({ id: "u1", email: "a@x.dev", sessionVersion: 0 });
    findUnique.mockResolvedValueOnce({ id: "u1", sessionVersion: 0 });
    await expect(resolveSessionUserId()).resolves.toEqual({ userId: "u1" });
  });

  it("expires a session stamped with an older version", async () => {
    session({ id: "u1", sessionVersion: 1 });
    findUnique.mockResolvedValueOnce({ id: "u1", sessionVersion: 2 });
    await expect(resolveSessionUserId()).resolves.toEqual({
      error: SESSION_EXPIRED_MESSAGE,
    });
  });

  it("falls back to email when the id is stale after a reseed", async () => {
    // The cookie keeps a cuid that no longer exists; the account does.
    session({ id: "old-cuid", email: "A@X.dev", sessionVersion: 0 });
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u-new", sessionVersion: 0 });

    await expect(resolveSessionUserId()).resolves.toEqual({ userId: "u-new" });
    // Addresses are stored lower-cased, so the lookup has to be too.
    expect(findUnique.mock.calls[1][0].where).toEqual({ email: "a@x.dev" });
  });

  it("expires rather than falling back when the email match is out of date", async () => {
    session({ id: "old", email: "a@x.dev", sessionVersion: 0 });
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u-new", sessionVersion: 5 });
    await expect(resolveSessionUserId()).resolves.toEqual({
      error: SESSION_EXPIRED_MESSAGE,
    });
  });

  it("expires when neither the id nor the email matches anyone", async () => {
    session({ id: "gone", email: "gone@x.dev" });
    findUnique.mockResolvedValue(null);
    await expect(resolveSessionUserId()).resolves.toEqual({
      error: SESSION_EXPIRED_MESSAGE,
    });
  });

  it("expires without touching the database when there is no session", async () => {
    session(null);
    await expect(resolveSessionUserId()).resolves.toEqual({
      error: SESSION_EXPIRED_MESSAGE,
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("expires when the session carries neither an id nor an email", async () => {
    session({ name: "Nameless" });
    await expect(resolveSessionUserId()).resolves.toEqual({
      error: SESSION_EXPIRED_MESSAGE,
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("works from an email alone, with no id in the session", async () => {
    session({ email: "a@x.dev", sessionVersion: 0 });
    findUnique.mockResolvedValueOnce({ id: "u1", sessionVersion: 0 });
    await expect(resolveSessionUserId()).resolves.toEqual({ userId: "u1" });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
