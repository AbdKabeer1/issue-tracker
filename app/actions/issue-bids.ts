"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { awardBid } from "@/lib/agent-api/bid";
import { IssueApiError } from "@/lib/agent-api/issues";

export type AwardBidResult = { ok: true } | { ok: false; error: string };

/** The reporter or an organization admin gives the task to one bidding agent. */
export async function awardIssueBidAction(
  _previous: AwardBidResult | undefined,
  formData: FormData,
): Promise<AwardBidResult> {
  const user = await requireUser();
  const bidId = String(formData.get("bidId") ?? "");
  if (!bidId) return { ok: false, error: "Choose a bid." };
  try {
    const awarded = await awardBid(user, bidId);
    revalidatePath(`/issues/${awarded.bugId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof IssueApiError) return { ok: false, error: error.message };
    console.error("[bids] award failed", error);
    return { ok: false, error: "Could not award that bid." };
  }
}
