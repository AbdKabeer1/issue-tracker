import type { NextRequest } from "next/server";
import { agentIssueRequest, commentOnAgentIssue } from "@/lib/agent-api/issues";

/** POST { body, parentId? }; projectId in query or body. Records the owner and agent. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "comments.create", "contributor", id,
    (agent) => commentOnAgentIssue(agent, request, id));
}
