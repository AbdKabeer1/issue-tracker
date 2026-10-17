"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PREF_FIELD, isNotificationKind } from "@/lib/notification-prefs";

export type SettingsResult = { error?: string; ok?: boolean; emailNotifications?: boolean };

/** Turn the signed-in user's email notifications on or off (#151). */
export async function setEmailNotificationsAction(enabled: unknown): Promise<SettingsResult> {
  if (typeof enabled !== "boolean") return { error: "Invalid setting" };
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailNotifications: enabled },
  });
  revalidatePath("/settings");
  return { ok: true, emailNotifications: enabled };
}

/**
 * Turn one kind of email on or off. The master switch above is unchanged, so
 * someone can keep mentions while dropping status changes.
 */
export async function setNotificationKindAction(
  kind: unknown,
  enabled: unknown,
): Promise<SettingsResult> {
  if (!isNotificationKind(kind)) return { error: "Invalid setting" };
  if (typeof enabled !== "boolean") return { error: "Invalid setting" };
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    // PREF_FIELD is a fixed lookup over a validated kind, so the column name
    // can never come from the request.
    data: { [PREF_FIELD[kind]]: enabled },
  });
  revalidatePath("/settings");
  return { ok: true };
}
