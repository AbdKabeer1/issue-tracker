"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { expireTag, TAGS } from "@/lib/lookups";
import { currentTenantIdFor, notificationInTenant } from "@/lib/tenant-context";

/** Marks all of the current user's notifications as read (#216). */
export async function markAllNotificationsReadAction(allWorkspaces = false): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const tenantId = allWorkspaces ? null : await currentTenantIdFor(user.id);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...notificationInTenant(tenantId, allWorkspaces) },
    data: { readAt: new Date() },
  });
  expireTag(TAGS.unread(user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
