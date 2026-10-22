"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { isTenantAdmin } from "@/lib/agents/membership";
import { undoAuditEvent } from "@/lib/agent-audit/undo";

export type UndoAuditActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Reverse an audited agent action from the audit page (#450).
 *
 * Only a workspace admin may undo, and only within their own tenant. The undo
 * itself is audited, so nothing is ever silently erased.
 */
export async function undoAuditEventAction(
  _previous: UndoAuditActionResult | undefined,
  formData: FormData,
): Promise<UndoAuditActionResult> {
  const user = await requireUser();

  const auditEventId = formData.get("auditEventId");
  if (typeof auditEventId !== "string" || !auditEventId) {
    return { ok: false, error: "Invalid audit event." };
  }

  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) {
    return { ok: false, error: "You're not a member of a workspace." };
  }
  if (!(await isTenantAdmin(user, tenantId))) {
    return { ok: false, error: "Only a workspace admin can undo actions." };
  }

  const result = await undoAuditEvent(prisma, {
    auditEventId,
    actorUserId: user.id,
    tenantId,
  });
  if (!result.ok) {
    return { ok: false, error: result.message };
  }

  revalidatePath("/settings/audit");
  return { ok: true, message: "Action undone." };
}
