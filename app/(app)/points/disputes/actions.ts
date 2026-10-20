"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor, NO_TENANT_MESSAGE } from "@/lib/tenant-context";
import { isTenantAdmin } from "@/lib/agents/membership";
import {
  correctEntry,
  disputeInputSchema,
  grantMissingAward,
  NOT_IN_WORKSPACE,
  NO_ENTRY_ON_THIS_DISPUTE,
  openDispute,
  rejectDispute,
} from "@/lib/points/disputes";

/** Open a dispute, or resolve one as a workspace admin (#436). */

export type DisputeActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; field?: string };

export async function openDisputeAction(
  _previous: DisputeActionResult | undefined,
  formData: FormData,
): Promise<DisputeActionResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { ok: false, error: NO_TENANT_MESSAGE };

  const parsed = disputeInputSchema.safeParse({
    bugNumber: formData.get("bugNumber"),
    kind: formData.get("kind"),
    role: formData.get("role") || undefined,
    pointEntryId: formData.get("pointEntryId") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid input.",
      field: issue?.path.join("."),
    };
  }

  const result = await openDispute(prisma, {
    tenantId,
    userId: user.id,
    input: parsed.data,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/points/disputes");
  return { ok: true, message: "Dispute opened. A workspace admin will review it." };
}

/**
 * One form, three decisions: grant the missing award, correct an entry, or
 * reject. Only workspace admins may resolve, and only once (#436).
 */
export async function resolveDisputeAction(
  _previous: DisputeActionResult | undefined,
  formData: FormData,
): Promise<DisputeActionResult> {
  const user = await requireUser();

  const disputeId = formData.get("disputeId");
  if (typeof disputeId !== "string" || !disputeId) {
    return { ok: false, error: "Invalid dispute." };
  }

  const dispute = await prisma.pointDispute.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      bugId: true,
      pointEntryId: true,
      status: true,
    },
  });
  if (!dispute) return { ok: false, error: "That dispute no longer exists." };

  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId || dispute.tenantId !== tenantId) {
    return { ok: false, error: NOT_IN_WORKSPACE };
  }
  if (!(await isTenantAdmin(user, dispute.tenantId))) {
    return { ok: false, error: "Only a workspace admin can resolve disputes." };
  }

  const noteValue = formData.get("note");
  const note = typeof noteValue === "string" ? noteValue : null;
  const decision = formData.get("decision");

  if (decision === "grant") {
    const role = formData.get("role");
    if (role !== "solver" && role !== "reporter") {
      return { ok: false, error: "Pick which award to grant.", field: "role" };
    }
    const bug = await prisma.bug.findUnique({
      where: { id: dispute.bugId },
      select: {
        id: true,
        number: true,
        tenantId: true,
        reporterId: true,
        assigneeId: true,
        severity: true,
      },
    });
    if (!bug || bug.tenantId !== dispute.tenantId) {
      return { ok: false, error: NOT_IN_WORKSPACE };
    }
    const result = await grantMissingAward(prisma, {
      dispute,
      bug,
      role,
      resolvedById: user.id,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/points/disputes");
    return {
      ok: true,
      message: result.awarded
        ? `Granted the missing ${role} award.`
        : "That award was already in the ledger, so nothing was added twice.",
    };
  }

  if (decision === "correct") {
    if (!dispute.pointEntryId) return { ok: false, error: NO_ENTRY_ON_THIS_DISPUTE };
    const entry = await prisma.pointEntry.findUnique({
      where: { id: dispute.pointEntryId },
      select: { id: true, tenantId: true, userId: true, bugId: true, role: true, points: true },
    });
    if (!entry || entry.tenantId !== dispute.tenantId) {
      return { ok: false, error: NOT_IN_WORKSPACE };
    }
    const result = await correctEntry(prisma, {
      dispute,
      entry,
      resolvedById: user.id,
      note,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/points/disputes");
    return {
      ok: true,
      message: "Entry corrected. The original is marked, and a reversing entry was written.",
    };
  }

  if (decision === "reject") {
    const result = await rejectDispute(prisma, { dispute, resolvedById: user.id, note });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/points/disputes");
    return { ok: true, message: "Dispute rejected." };
  }

  return { ok: false, error: "Unknown decision." };
}
