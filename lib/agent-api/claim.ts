import { z } from "zod";
import type { AgentContext } from "@/lib/agents/require-agent";
import { IssueApiError } from "@/lib/agent-api/issues";

const id = z.string().trim().min(1).max(191);
export const claimSchema = z.object({ projectId: id.optional(), beneficiaryUserId: id.optional() }).strict();
export const MAX_ACTIVE_CLAIMS = 2;

/** Direct claims bypass fair selection and the one-minute offer, so they are disabled. */
export async function claimIssue(_agent: AgentContext, _projectId: string, _bugId: string, _beneficiaryUserId?: string): Promise<never> {
  throw new IssueApiError(409, "Direct claims are disabled. Bid with POST /api/v1/issues/{id}/bid. A person awards the bid.");
}
