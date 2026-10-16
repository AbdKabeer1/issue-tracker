"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { categorySchema } from "@/lib/validations/bug";

export type CategoryActionResult = {
  error?: string;
  ok?: boolean;
};

export async function createCategoryAction(
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category name" };
  }

  const existing = await prisma.category.findUnique({
    where: { name: parsed.data.name },
  });

  if (existing) {
    return { error: "A category with this name already exists" };
  }

  await prisma.category.create({
    data: {
      name: parsed.data.name,
      isActive: true,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/bugs/new");
  revalidatePath("/bugs");
  return { ok: true };
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category name" };
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return { error: "Category not found" };
  }

  const duplicate = await prisma.category.findUnique({
    where: { name: parsed.data.name },
  });

  if (duplicate && duplicate.id !== categoryId) {
    return { error: "A category with this name already exists" };
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/bugs/new");
  revalidatePath("/bugs");
  return { ok: true };
}

export async function toggleCategoryStatusAction(
  categoryId: string,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return { error: "Category not found" };
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: { isActive: !category.isActive },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/bugs/new");
  revalidatePath("/bugs");
  return { ok: true };
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return { error: "Category not found" };
  }

  const bugCount = await prisma.bug.count({
    where: { categoryId },
  });

  if (bugCount > 0) {
    return {
      error: `Cannot delete category: it is currently used by ${bugCount} issue${bugCount === 1 ? "" : "s"}. Please reassign or deactivate it instead.`,
    };
  }

  try {
    await prisma.category.delete({
      where: { id: categoryId },
    });
  } catch {
    return { error: "Failed to delete category" };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/bugs/new");
  revalidatePath("/bugs");
  return { ok: true };
}
