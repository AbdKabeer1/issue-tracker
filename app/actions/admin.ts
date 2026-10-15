"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { isSuperAdmin } from "@/lib/roles";

export type AdminActionResult = { error?: string; ok?: boolean };

/**
 * Promote a user to admin. Super admins only.
 * Refuses to change another super_admin or the caller's own role.
 */
export async function promoteUserToAdminAction(
  userId: string,
): Promise<AdminActionResult> {
  const actor = await requireSuperAdmin();

  if (!userId || typeof userId !== "string") {
    return { error: "Invalid user" };
  }

  if (userId === actor.id) {
    return { error: "You cannot change your own role here" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!target) {
    return { error: "User not found" };
  }

  if (isSuperAdmin(target.role)) {
    return { error: "Cannot change a super admin's role" };
  }

  if (target.role === "admin") {
    return { error: "User is already an admin" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: "admin" },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}
