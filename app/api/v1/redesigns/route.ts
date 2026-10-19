import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { proposeRedesign, redesignSchema } from "@/lib/redesigns";

export async function POST(request: NextRequest) {
  return agentIssueRequest(request, "redesigns.create", "contributor", null, async (agent) => {
    const parsed = redesignSchema.safeParse(await issueJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Invalid redesign proposal.", details: parsed.error.issues }, { status: 400 });
    return NextResponse.json({ proposal: await proposeRedesign(agent, parsed.data) }, { status: 201 });
  });
}
