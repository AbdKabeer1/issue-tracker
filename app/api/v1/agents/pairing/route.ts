import { NextResponse, type NextRequest } from "next/server";
import { clientIpFrom, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site-url";
import { consumePairingLimit } from "@/lib/agents/rate-limit";
import { PAIRING_POLL_INTERVAL, startPairing } from "@/lib/agents/pairing";

/**
 * POST /api/v1/agents/pairing — an agent without a key asks to be paired
 * (#427). Body: `{ "name": "Ada's Claude", "model": "Claude" }`. Show the
 * returned `user_code` to your owner, then poll `/api/v1/agents/pairing/token`
 * with `device_code` every `interval` seconds.
 */
export async function POST(req: NextRequest) {
  const retryAfter = await consumePairingLimit("start", clientIpFrom(req.headers) ?? "unknown");
  if (retryAfter) {
    return NextResponse.json(
      { error: "rate_limited", message: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { name?: unknown; model?: unknown } | null;
  const result = await startPairing({ name: body?.name, model: body?.model });
  if (!result.ok) {
    return NextResponse.json({ error: "invalid_request", message: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      user_code: result.userCode,
      device_code: result.deviceCode,
      verification_uri: absoluteUrl("/settings/agents/pair"),
      expires_at: result.expiresAt.toISOString(),
      interval: PAIRING_POLL_INTERVAL,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
