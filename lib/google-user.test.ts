import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));
vi.mock("@/lib/super-admin", () => ({ isSuperAdminEmail: () => false }));
const twoFactor = vi.hoisted(() => ({ clearTwoFactorAfterPasswordRemoved: vi.fn(async () => true) }));
vi.mock("@/lib/two-factor", () => twoFactor);

import { prisma } from "@/lib/prisma";
import { upsertGoogleUser } from "./google-user";

const upsert = prisma.user.upsert as unknown as ReturnType<typeof vi.fn>;
const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const executeRaw = prisma.$executeRaw as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertGoogleUser (#351)", () => {
  it("does not overwrite existing user display name on login and returns sessionVersion", async () => {
    upsert.mockResolvedValueOnce({ id: "db1", name: "Custom Name", role: "user", sessionVersion: 0 });
    const result = await upsertGoogleUser({ email: "A@x.dev", name: "Google Name" });

    expect(result).toEqual({ id: "db1", name: "Custom Name", role: "user", sessionVersion: 0 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].where).toEqual({ email: "a@x.dev" });
    expect(upsert.mock.calls[0][0].create.name).toBe("Google Name");
    // Ensure update payload does NOT overwrite name (#351)
    expect(upsert.mock.calls[0][0].update.name).toBeUndefined();
  });

  it("never overwrites the name of an existing account (#293)", async () => {
    // A display name chosen in Settings must survive the next Google sign-in.
    upsert.mockResolvedValueOnce({ id: "db1", name: "Custom Name", role: "user", sessionVersion: 0 });
    await upsertGoogleUser({ email: "a@x.dev", name: "Google Name", image: "https://img.test/a.png" });
    const { create, update } = upsert.mock.calls[0][0];
    expect(create.name).toBe("Google Name");
    expect(update).not.toHaveProperty("name");
    expect(update.image).toBe("https://img.test/a.png");
  });

  it("retries with email and without name overwrite when the full upsert fails (#351)", async () => {
    upsert.mockRejectedValueOnce(new Error("column image does not exist"));
    upsert.mockResolvedValueOnce({ id: "db2", name: "Custom Name", sessionVersion: 0 });
    await expect(upsertGoogleUser({ email: "a@x.dev", name: "Google Name" })).resolves.toEqual({
      id: "db2",
      name: "Custom Name",
      role: "user",
      sessionVersion: 0,
    });
    expect(upsert.mock.calls[1][0].create).toEqual({ email: "a@x.dev", name: "Google Name" });
    expect(upsert.mock.calls[1][0].update).toEqual({});
    expect(upsert.mock.calls[1][0].select).toEqual({ id: true, name: true, sessionVersion: true });
  });

  it("inserts directly with DO NOTHING when Prisma upserts both fail", async () => {
    upsert.mockRejectedValue(new Error("column missing"));
    executeRaw.mockRejectedValueOnce(new Error("passwordHash"));
    executeRaw.mockResolvedValueOnce(1);
    findUnique.mockResolvedValueOnce(undefined); // account pre-read (#736)
    findUnique.mockResolvedValueOnce({ id: "existing", name: "Existing User", sessionVersion: 0 });
    await expect(upsertGoogleUser({ email: "a@x.dev", name: "Existing User" })).resolves.toEqual({
      id: "existing",
      name: "Existing User",
      role: "user",
      sessionVersion: 0,
    });
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "a@x.dev" },
      select: { id: true, name: true, sessionVersion: true },
    });
  });

  it("neutralizes the password of an unverified credentials account it adopts (#736)", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: null });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 2 });

    await upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true });

    const { update } = upsert.mock.calls[0][0];
    expect(update.passwordHash).toBeNull();
    expect(update.emailVerified).toBeInstanceOf(Date);
  });

  it("refuses to link an unverified Google email to a password account (#736)", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: null });

    await expect(
      upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: false }),
    ).rejects.toThrow(/unverified/i);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps the password of a verified credentials account (#736)", async () => {
    findUnique.mockResolvedValueOnce({
      passwordHash: "hash",
      emailVerified: new Date(),
    });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 0 });

    await upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true });

    expect(upsert.mock.calls[0][0].update.passwordHash).toBeUndefined();
  });

  it("does not touch accounts without a password (#736)", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: null, emailVerified: null });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 0 });

    await upsertGoogleUser({ email: "g-only@x.dev", emailVerified: true });

    expect(upsert.mock.calls[0][0].update.passwordHash).toBeUndefined();
  });
});

describe("two-factor left behind by a removed password (#388)", () => {
  it("clears it when Google removes an unverified password", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: null });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 2 });
    await upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true });
    expect(twoFactor.clearTwoFactorAfterPasswordRemoved).toHaveBeenCalledWith("u9");
  });

  it("also clears it on the fallback upsert", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: null });
    upsert.mockRejectedValueOnce(new Error("column image does not exist"));
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", sessionVersion: 0 });
    await upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true });
    expect(twoFactor.clearTwoFactorAfterPasswordRemoved).toHaveBeenCalledWith("u9");
  });

  it("leaves two-factor alone when the password is kept or there is none", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: new Date() });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 0 });
    await upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true });
    findUnique.mockResolvedValueOnce({ passwordHash: null, emailVerified: null });
    upsert.mockResolvedValueOnce({ id: "u8", name: "N", role: "user", sessionVersion: 0 });
    await upsertGoogleUser({ email: "g-only@x.dev", emailVerified: true });
    expect(twoFactor.clearTwoFactorAfterPasswordRemoved).not.toHaveBeenCalled();
  });

  it("still signs the person in if the cleanup fails", async () => {
    findUnique.mockResolvedValueOnce({ passwordHash: "hash", emailVerified: null });
    upsert.mockResolvedValueOnce({ id: "u9", name: "N", role: "user", sessionVersion: 2 });
    twoFactor.clearTwoFactorAfterPasswordRemoved.mockRejectedValueOnce(new Error("db down"));
    await expect(upsertGoogleUser({ email: "human@x.dev", name: "Human", emailVerified: true })).resolves.toMatchObject({ id: "u9" });
  });
});
