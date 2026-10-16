"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { canDeleteIssueType, issueTypeInputSchema } from "@/lib/issue-types";

export type IssueTypeActionResult = { error?: string; ok?: boolean };

export async function createIssueTypeAction(
  formData: FormData,
): Promise<IssueTypeActionResult> {
  await requireAdmin();

  const rawName = formData.get("name")?.toString() ?? "";
  const rawDesc = formData.get("description")?.toString() ?? "";
  const rawActive = formData.get("isActive");
  const isActive = rawActive !== null ? rawActive === "true" || rawActive === "on" : true;

  const parsed = issueTypeInputSchema.safeParse({
    name: rawName,
    description: rawDesc ? rawDesc : null,
    isActive,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.issueType.findUnique({
    where: { name: parsed.data.name },
  });

  if (existing) {
    return { error: `A type named "${parsed.data.name}" already exists.` };
  }

  await prisma.issueType.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath("/admin/types");
  revalidatePath("/bugs/new");
  return { ok: true };
}

export async function updateIssueTypeAction(
  id: string,
  formData: FormData,
): Promise<IssueTypeActionResult> {
  await requireAdmin();

  if (!id || typeof id !== "string") {
    return { error: "Invalid type ID" };
  }

  const rawName = formData.get("name")?.toString() ?? "";
  const rawDesc = formData.get("description")?.toString() ?? "";
  const rawActive = formData.get("isActive");
  const isActive = rawActive !== null ? rawActive === "true" || rawActive === "on" : true;

  const parsed = issueTypeInputSchema.safeParse({
    name: rawName,
    description: rawDesc ? rawDesc : null,
    isActive,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.issueType.findFirst({
    where: {
      name: parsed.data.name,
      NOT: { id },
    },
  });

  if (existing) {
    return { error: `Another type named "${parsed.data.name}" already exists.` };
  }

  await prisma.issueType.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath("/admin/types");
  revalidatePath("/bugs/new");
  revalidatePath("/bugs");
  return { ok: true };
}

export async function toggleIssueTypeActiveAction(
  id: string,
): Promise<IssueTypeActionResult> {
  await requireAdmin();

  if (!id || typeof id !== "string") {
    return { error: "Invalid type ID" };
  }

  const existing = await prisma.issueType.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!existing) {
    return { error: "Type not found" };
  }

  await prisma.issueType.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/types");
  revalidatePath("/bugs/new");
  return { ok: true };
}

export async function deleteIssueTypeAction(
  id: string,
): Promise<IssueTypeActionResult> {
  await requireAdmin();

  if (!id || typeof id !== "string") {
    return { error: "Invalid type ID" };
  }

  const count = await prisma.bug.count({
    where: { typeId: id },
  });

  const check = canDeleteIssueType(count);
  if (!check.allowed) {
    return { error: check.reason };
  }

  await prisma.issueType.delete({
    where: { id },
  });

  revalidatePath("/admin/types");
  revalidatePath("/bugs/new");
  return { ok: true };
}

