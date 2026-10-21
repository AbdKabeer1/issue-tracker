import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  confirmIdentity: vi.fn(),
  startEnrolment: vi.fn(),
  confirmEnrolment: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  findUser: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUser } } }));
vi.mock("@/lib/two-factor", () => ({
  confirmIdentity: mocks.confirmIdentity,
  startEnrolment: mocks.startEnrolment,
  confirmEnrolment: mocks.confirmEnrolment,
  disableTwoFactor: mocks.disableTwoFactor,
  regenerateBackupCodes: mocks.regenerateBackupCodes,
}));

import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  startTwoFactorAction,
} from "./actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "u1", email: "ada@example.com" });
  mocks.confirmIdentity.mockResolvedValue({ ok: true });
  mocks.findUser.mockResolvedValue({ email: "ada@example.com" });
});

describe("startTwoFactorAction", () => {
  it("re-authenticates with the password before making a secret", async () => {
    mocks.confirmIdentity.mockResolvedValue({ ok: false, error: "That password isn't right." });
    expect(await startTwoFactorAction(form({ password: "nope" }))).toEqual({ ok: false, error: "That password isn't right." });
    expect(mocks.confirmIdentity).toHaveBeenCalledWith("u1", { password: "nope" });
    expect(mocks.startEnrolment).not.toHaveBeenCalled();
  });

  it("returns the key and a QR image for the otpauth link", async () => {
    mocks.startEnrolment.mockResolvedValue({
      ok: true,
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/Ziki%20Issues:ada%40example.com?secret=JBSWY3DPEHPK3PXP",
    });
    const result = await startTwoFactorAction(form({ password: "pw" }));
    expect(mocks.startEnrolment).toHaveBeenCalledWith("u1", "ada@example.com");
    expect(result).toMatchObject({ ok: true, secret: "JBSWY3DPEHPK3PXP" });
    expect(result.ok && result.qr).toMatch(/^data:image\/png;base64,/);
  });

  it("passes on a refusal, such as two-factor already being on", async () => {
    mocks.startEnrolment.mockResolvedValue({ ok: false, error: "Already on." });
    expect(await startTwoFactorAction(form({ password: "pw" }))).toEqual({ ok: false, error: "Already on." });
  });
});

describe("confirmTwoFactorAction", () => {
  it("returns the backup codes and refreshes the page on success", async () => {
    mocks.confirmEnrolment.mockResolvedValue({ ok: true, codes: ["AAAAA-BBBBB"] });
    expect(await confirmTwoFactorAction(form({ code: "123456" }))).toEqual({ ok: true, codes: ["AAAAA-BBBBB"] });
    expect(mocks.confirmEnrolment).toHaveBeenCalledWith("u1", "123456");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/security");
  });

  it("does not refresh on a wrong code", async () => {
    mocks.confirmEnrolment.mockResolvedValue({ ok: false, error: "That code isn't right." });
    expect((await confirmTwoFactorAction(form({ code: "000000" }))).ok).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("disableTwoFactorAction and regenerateBackupCodesAction", () => {
  it("need the password and a current code, checked inside the call", async () => {
    mocks.regenerateBackupCodes.mockResolvedValue({ ok: true, codes: [] });
    await disableTwoFactorAction(form({ password: "pw", code: "123456" }));
    expect(mocks.confirmIdentity).toHaveBeenCalledWith("u1", { password: "pw", code: "123456" });
    await regenerateBackupCodesAction(form({ password: "pw", code: "ABCDE-FGHJK" }));
    expect(mocks.confirmIdentity).toHaveBeenLastCalledWith("u1", { password: "pw", code: "ABCDE-FGHJK" });
  });

  it("change nothing when re-authentication fails", async () => {
    mocks.confirmIdentity.mockResolvedValue({ ok: false, error: "That code isn't right." });
    expect(await disableTwoFactorAction(form({ password: "pw", code: "000000" }))).toEqual({ ok: false, error: "That code isn't right." });
    expect(await regenerateBackupCodesAction(form({ password: "pw", code: "000000" }))).toEqual({ ok: false, error: "That code isn't right." });
    expect(mocks.disableTwoFactor).not.toHaveBeenCalled();
    expect(mocks.regenerateBackupCodes).not.toHaveBeenCalled();
  });

  it("turn off and make new codes once re-authenticated", async () => {
    mocks.regenerateBackupCodes.mockResolvedValue({ ok: true, codes: ["XXXXX-YYYYY"] });
    expect(await disableTwoFactorAction(form({ password: "pw", code: "123456" }))).toEqual({ ok: true });
    expect(mocks.disableTwoFactor).toHaveBeenCalledWith("u1");
    expect(await regenerateBackupCodesAction(form({ password: "pw", code: "123456" }))).toEqual({ ok: true, codes: ["XXXXX-YYYYY"] });
  });
});
