import { timingSafeEqual, createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueDeliveries } from "@/lib/webhooks/deliver";
import { pruneAgentRows } from "@/lib/agent-retention";
import { prisma } from "@/lib/prisma";
import { isAgentPlatformEnabled } from "@/lib/feature-flags";
import { agentPlatformDisabledResponse } from "@/lib/agents/platform-gate";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduler only; agent API keys cannot dispatch other agents' subscriptions. */
export async function POST(request: NextRequest) {
  if (!isAgentPlatformEnabled()) return agentPlatformDisabledResponse();
  const secret = process.env.WEBHOOK_DISPATCH_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret) return NextResponse.json({ error: "Webhook dispatcher is not configured." }, { status: 503, headers });
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(request.headers.get("authorization") ?? ""), hash(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  try {
    const processed = await dispatchDueDeliveries();
    // Bounded data retention sweep (1 in N runs does the work, #546); a
    // failing sweep never blocks delivery — the next run picks it up.
    await pruneAgentRows(prisma).catch(() => null);
    return NextResponse.json({ processed }, { headers });
  } catch { return NextResponse.json({ error: "Dispatch unavailable; queued deliveries will retry." }, { status: 503, headers }); }
}
