"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

/** Watch or unwatch an issue (#216). Anyone who can see the issue may. */
export async function setWatchingAction(
  bugId: string,
  watching: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true, isDeleted: true },
  });
  if (!bug || bug.isDeleted) return { error: "Issue not found" };

  await prisma.issueWatch.upsert({
    where: { userId_bugId: { userId: user.id, bugId } },
    create: { userId: user.id, bugId, watching: Boolean(watching) },
    update: { watching: Boolean(watching) },
  });
  revalidatePath(`/bugs/${bugId}`);
  return { ok: true };
}
