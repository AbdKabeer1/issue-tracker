"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { isTenantAdmin } from "@/lib/agents/membership";
import {
  PointsExportSecretError,
  buildPointsSnapshot,
  pointsExportSecret,
  snapshotCsv,
  snapshotHash,
  snapshotJson,
  snapshotSignature,
} from "@/lib/points/snapshot";

export type PointsSnapshotResult =
  | { ok: true; cutoff: string; hash: string; signature: string; json: string; csv: string }
  | { ok: false; error: string };

/** Blank means "now"; anything else is an ISO-8601 date or timestamp. */
const cutoffSchema = z.union([z.literal(""), z.coerce.date()]);

/**
 * Snapshot every balance in the workspace at a cutoff (#618).
 *
 * Only a workspace admin may export, and only their own tenant's balances —
 * the same door as the other admin reads. The result carries both files plus
 * the content hash and its signature; re-running with the same cutoff over the
 * same ledger returns byte-identical JSON and the same hash (`lib/points/snapshot.ts`).
 *
 * `previous` exists so this can be wired to `useActionState` like the other
 * settings actions; nothing in it is read.
 */
export async function exportPointsSnapshotAction(
  _previous: PointsSnapshotResult | undefined,
  formData: FormData,
): Promise<PointsSnapshotResult> {
  const user = await requireUser();

  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { ok: false, error: "You're not a member of a workspace." };
  if (!(await isTenantAdmin(user, tenantId))) {
    return { ok: false, error: "Only a workspace admin can export balances." };
  }

  const cutoffInput = cutoffSchema.safeParse(formData.get("cutoff") ?? "");
  if (!cutoffInput.success) {
    return { ok: false, error: "Cutoff must be an ISO-8601 date or timestamp." };
  }
  const cutoff = cutoffInput.data === "" ? new Date() : cutoffInput.data;

  let secret: string;
  try {
    secret = pointsExportSecret();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof PointsExportSecretError ? error.message : "Export signing is not configured.",
    };
  }

  const snapshot = await buildPointsSnapshot(prisma, { tenantId, cutoff });
  const hash = snapshotHash(snapshot);
  const signature = snapshotSignature({ hash, secret });

  return {
    ok: true,
    cutoff: snapshot.cutoff,
    hash,
    signature,
    json: snapshotJson(snapshot, { hash, signature }),
    csv: snapshotCsv(snapshot),
  };
}
