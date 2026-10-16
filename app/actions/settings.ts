"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

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
