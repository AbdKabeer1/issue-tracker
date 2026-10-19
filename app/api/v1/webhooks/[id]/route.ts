import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/v1/webhooks/[id]  — delete a webhook subscription.
 * PATCH  /api/v1/webhooks/[id]  — re-enable a disabled subscription.
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return agentIssueRequest(request, "webhooks.delete", "contributor", id, async (agent) => {
    try {
      const existing = await prisma.webhookSubscription.findFirst({
        where: { id, agentId: agent.agentId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Webhook subscription not found." }, { status: 404 });
      }
      await prisma.webhookSubscription.delete({ where: { id } });
      return new NextResponse(null, { status: 204 });
    } catch { return NextResponse.json({ error: "Webhook storage unavailable." }, { status: 503 }); }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return agentIssueRequest(request, "webhooks.enable", "contributor", id, async (agent) => {
    try {
      const existing = await prisma.webhookSubscription.findFirst({
        where: { id, agentId: agent.agentId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Webhook subscription not found." }, { status: 404 });
      }
      const subscription = await prisma.webhookSubscription.update({
        where: { id },
        data: { enabled: true, disabledAt: null, failureCount: 0 },
        select: { id: true, url: true, enabled: true, failureCount: true, createdAt: true, updatedAt: true },
      });
      return NextResponse.json({ subscription });
    } catch { return NextResponse.json({ error: "Webhook storage unavailable." }, { status: 503 }); }
  });
}
