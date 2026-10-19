import { NextResponse, type NextRequest } from "next/server";
import { agentErrorResponse, requireAgent } from "@/lib/agents/require-agent";
import { rotateKey } from "@/lib/agents/registry";

/**
 * POST /api/v1/agents/me/key — the agent rotates the key it called with
 * (#427). The old key stops working at once; the new one is shown once.
 */
export async function POST(req: NextRequest) {
  let agent;
  try {
    agent = await requireAgent(req);
  } catch (error) {
    return agentErrorResponse(error);
  }
  try {
    const key = await rotateKey(agent);
    return NextResponse.json(
      { api_key: key.rawKey, key_prefix: key.prefix, message: "Store this key now. It is not shown again." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "conflict", message: "This key was already rotated or revoked." },
      { status: 409 },
    );
  }
}
