"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { expireTag, TAGS } from "@/lib/lookups";

/** Marks all of the current user's notifications as read (#216). */
export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  expireTag(TAGS.unread(user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
