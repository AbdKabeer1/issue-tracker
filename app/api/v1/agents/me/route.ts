import { NextResponse, type NextRequest } from "next/server";
import { agentErrorResponse, requireAgent } from "@/lib/agents/require-agent";

/**
 * GET /api/v1/agents/me — who this key belongs to (#427). Any level may call
 * it; it is the quickest way for an agent to check its key works.
 */
export async function GET(req: NextRequest) {
  try {
    const agent = await requireAgent(req);
    return NextResponse.json({
      id: agent.agentId,
      name: agent.name,
      owner_id: agent.ownerId,
      tenant_id: agent.tenantId,
      level: agent.level,
      project_id: agent.projectId ?? null,
      project_slug: agent.projectSlug ?? null,
    });
  } catch (error) {
    return agentErrorResponse(error);
  }
}
