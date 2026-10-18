"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { milestoneInputSchema, parseDueDate } from "@/lib/milestones";

export type MilestoneActionResult = { ok?: true; error?: string; cleared?: number };

const NOT_FOUND = "That milestone no longer exists.";

function isCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === code;
}

function revalidateMilestones() {
  revalidatePath("/admin/milestones");
  revalidatePath("/milestones");
  revalidatePath("/bugs");
}

function readInput(formData: FormData) {
  const due = parseDueDate(formData.get("dueDate")?.toString());
  if (due === "invalid") return { error: "Pick a valid due date, or leave it empty." } as const;
  const rawDescription = formData.get("description")?.toString() ?? "";
  const parsed = milestoneInputSchema.safeParse({
    title: formData.get("title")?.toString() ?? "",
    description: rawDescription.trim() ? rawDescription : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;
  return { data: { ...parsed.data, dueDate: due } } as const;
}

async function titleTaken(title: string, exceptId?: string) {
  return prisma.milestone.findFirst({
    where: { title: { equals: title, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { title: true },
  });
}

export async function createMilestoneAction(formData: FormData): Promise<MilestoneActionResult> {
  await requireAdmin();
  const input = readInput(formData);
  if ("error" in input) return { error: input.error };
  const taken = await titleTaken(input.data.title);
  if (taken) return { error: `A milestone named "${taken.title}" already exists.` };
  try {
    await prisma.milestone.create({ data: input.data });
  } catch (err) {
    if (isCode(err, "P2002")) return { error: `A milestone named "${input.data.title}" already exists.` };
    throw err;
  }
  revalidateMilestones();
  return { ok: true };
}

export async function updateMilestoneAction(id: string, formData: FormData): Promise<MilestoneActionResult> {
  await requireAdmin();
  const input = readInput(formData);
  if ("error" in input) return { error: input.error };
  const taken = await titleTaken(input.data.title, id);
  if (taken) return { error: `Another milestone is named "${taken.title}".` };
  try {
    await prisma.milestone.update({ where: { id }, data: input.data });
  } catch (err) {
    if (isCode(err, "P2025")) return { error: NOT_FOUND };
    if (isCode(err, "P2002")) return { error: `Another milestone is named "${input.data.title}".` };
    throw err;
  }
  revalidateMilestones();
  return { ok: true };
}

/** Closing leaves every issue where it is; it only stops new ones joining. */
export async function setMilestoneClosedAction(id: string, closed: boolean): Promise<MilestoneActionResult> {
  await requireAdmin();
  try {
    await prisma.milestone.update({
      where: { id },
      data: { isClosed: closed, closedAt: closed ? new Date() : null },
    });
  } catch (err) {
    if (isCode(err, "P2025")) return { error: NOT_FOUND };
    throw err;
  }
  revalidateMilestones();
  return { ok: true };
}

/** The issues stay; the database clears their milestone (SET NULL). */
export async function deleteMilestoneAction(id: string): Promise<MilestoneActionResult> {
  await requireAdmin();
  const cleared = await prisma.bug.count({ where: { milestoneId: id } });
  try {
    await prisma.milestone.delete({ where: { id } });
  } catch (err) {
    if (isCode(err, "P2025")) return { error: NOT_FOUND };
    throw err;
  }
  revalidateMilestones();
  return { ok: true, cleared };
}
