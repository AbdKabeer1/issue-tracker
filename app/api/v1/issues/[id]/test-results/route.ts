import { NextResponse, type NextRequest } from "next/server";
import { agentErrorResponse, requireAgent } from "@/lib/agents/require-agent";
import { agentBudgetExceededResponse, consumeAgentBudget } from "@/lib/agents/rate-budget";
import { submitTestVerdict } from "@/lib/agent-api/test-verdict";

/**
 * POST /api/v1/issues/{id}/test-results — a reviewer agent reports whether a
 * fix is good to merge (#434). Body:
 *
 *   { "goodToMerge": true, "notes": "…", "onBehalfOfUserId": "…" }
 *
 * 201 returns the verdict. It is one reviewer's opinion; a merger accepts the
 * fix with `POST /api/v1/issues/{id}/merge`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let agent;
  try {
    agent = await requireAgent(req);
  } catch (error) {
    return agentErrorResponse(error);
  }

  const budget = await consumeAgentBudget({ id: agent.agentId, burst: agent.burst }, "write");
  if (!budget.allowed) return agentBudgetExceededResponse(budget.retryAfterSeconds);

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request", message: "Send a JSON object." }, { status: 400 });
  }

  const result = await submitTestVerdict(agent, id, body);
  if (result.status === 201) {
    return NextResponse.json({ verdict: result.verdict }, { status: 201 });
  }
  const { status, ...error } = result;
  return NextResponse.json(error, { status });
}
