"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  confirmEnrolment,
  confirmIdentity,
  disableTwoFactor,
  regenerateBackupCodes,
  startEnrolment,
} from "@/lib/two-factor";

/**
 * Two-factor settings (#648). Every action acts as the signed-in person and
 * re-authenticates inside the call (password, plus a code once it is on), so a
 * session left open on a shared computer cannot turn the factor off.
 */

export type StartTwoFactorResult =
  | { ok: true; secret: string; qr: string }
  | { ok: false; error: string };
export type BackupCodesActionResult = { ok: true; codes: string[] } | { ok: false; error: string };
export type PlainActionResult = { ok: true } | { ok: false; error: string };

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function startTwoFactorAction(formData: FormData): Promise<StartTwoFactorResult> {
  const user = await requireUser();
  const identity = await confirmIdentity(user.id, { password: text(formData.get("password")) });
  if (!identity.ok) return identity;

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  const started = await startEnrolment(user.id, account?.email ?? user.email ?? user.id);
  if (!started.ok) return started;
  const qr = await QRCode.toDataURL(started.uri, { margin: 1, width: 220 });
  return { ok: true, secret: started.secret, qr };
}

export async function confirmTwoFactorAction(formData: FormData): Promise<BackupCodesActionResult> {
  const user = await requireUser();
  const result = await confirmEnrolment(user.id, text(formData.get("code")));
  if (result.ok) revalidatePath("/settings/security");
  return result;
}

export async function disableTwoFactorAction(formData: FormData): Promise<PlainActionResult> {
  const user = await requireUser();
  const identity = await confirmIdentity(user.id, {
    password: text(formData.get("password")),
    code: text(formData.get("code")),
  });
  if (!identity.ok) return identity;
  await disableTwoFactor(user.id);
  revalidatePath("/settings/security");
  return { ok: true };
}

export async function regenerateBackupCodesAction(formData: FormData): Promise<BackupCodesActionResult> {
  const user = await requireUser();
  const identity = await confirmIdentity(user.id, {
    password: text(formData.get("password")),
    code: text(formData.get("code")),
  });
  if (!identity.ok) return identity;
  const result = await regenerateBackupCodes(user.id);
  if (result.ok) revalidatePath("/settings/security");
  return result;
}
