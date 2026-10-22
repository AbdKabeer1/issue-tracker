import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { loadOwnAgents } from "@/lib/dashboard-overview";

/**
 * The Overview agents table polls this every 30 seconds so the section can
 * refresh on its own without re-rendering the whole page. Read-only, scoped
 * to the signed-in owner's agents in the current workspace.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const tenantId = await currentTenantIdFor(session.user.id);
    const agents = await loadOwnAgents({
      userId: session.user.id,
      tenantId,
    });
    return NextResponse.json(
      {
        agents: agents.map((agent) => ({
          ...agent,
          lastSeenAt: agent.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[dashboard] agents poll failed", error);
    return NextResponse.json({ error: "Could not load agents" }, { status: 500 });
  }
}
