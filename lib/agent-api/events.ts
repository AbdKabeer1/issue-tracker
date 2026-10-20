import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Agent event feed (#445).
 *
 * Agents poll `GET /api/v1/events?after=&afterId=&wait=` to learn what changed
 * inside their tenant. The cursor is `(createdAt, id)` on `AgentEvent` — the
 * same composite the index covers.
 *
 * Webhooks deliver the same event ids, so a client can dedupe across both
 * channels.
 */

export const EVENT_MAX_WAIT_SECONDS = 25;
export const EVENT_POLL_INTERVAL_MS = 500; // first check; later ones back off (#545)
export const EVENT_MAX_POLL_INTERVAL_MS = 4_000;

/**
 * Delay before the next long-poll query (#545). Starts at 500 ms so a waiter
 * still learns about a new event quickly, then doubles up to 4 s: a client
 * waiting the full 25 s makes ~8 queries instead of 50.
 */
export function nextPollDelayMs(attempt: number, maxMs = EVENT_MAX_POLL_INTERVAL_MS): number {
  if (!Number.isFinite(attempt) || attempt < 0) return EVENT_POLL_INTERVAL_MS;
  return Math.min(maxMs, EVENT_POLL_INTERVAL_MS * 2 ** Math.min(Math.floor(attempt), 10));
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Every event type `publish()` writes (#534). One source of truth: the doc's
 * event list and `event-types.test.ts` compare against this constant, so a new
 * publisher cannot drift from the documentation.
 */
export const AGENT_EVENT_TYPES = [
  "claim.accepted",
  "claim.offered",
  "claim.released",
  "comment.created",
  "comment.deleted",
  "comment.edited",
  "github.merge_failed",
  "issue.accepted",
  "issue.bid",
  "issue.bid_awarded",
  "issue.bid_withdrawn",
  "issue.confirmed",
  "issue.created",
  "issue.deleted",
  "issue.restored",
  "issue.structured",
  "issue.test_verdict",
  "issue.updated",
  "issue.validated",
  "question.answered",
  "question.asked",
  "redesign.proposed",
  "review.completed",
  "review.requested",
] as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

export type EventPayload = Prisma.InputJsonObject;

/**
 * Writes one `AgentEvent` row. Call this inside the same transaction that
 * performs the domain change so the event commits atomically with it.
 *
 * Export contract: other issues call `publish()` to emit events into the feed.
 * This PR adds `issue.created` and `comment.created`.
 */
export async function publish(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    tenantId: string;
    type: string;
    payload: EventPayload;
    actorAgentId?: string | null;
    bugId?: string | null;
  },
): Promise<{ id: string }> {
  const event = await db.agentEvent.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      payload: params.payload,
      actorAgentId: params.actorAgentId ?? null,
      bugId: params.bugId ?? null,
    },
    select: { id: true },
  });
  const subscriptions = await db.webhookSubscription.findMany({
    where: { enabled: true, agent: { tenantId: params.tenantId, revokedAt: null,
      owner: { memberships: { some: { tenantId: params.tenantId } } } },
      // Empty filter = every event; otherwise only the subscribed types (#512).
      OR: [{ events: { isEmpty: true } }, { events: { has: params.type } }] },
    select: { id: true },
  });
  if (subscriptions.length) await db.webhookDelivery.createMany({
    data: subscriptions.map(({ id }) => ({ subscriptionId: id, eventId: event.id, nextAttemptAt: new Date() })),
    skipDuplicates: true,
  });
  return event;
}

// Make the type importable without importing Prisma everywhere.
type PrismaClient = typeof prisma;

// ---------------------------------------------------------------------------
// Poll cursor
// ---------------------------------------------------------------------------

export type EventCursor = { createdAt: Date; id: string };

/** Encode a cursor to an opaque string safe in query parameters. */
export function encodeEventCursor(cursor: EventCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString("base64url");
}

/** Decode a cursor produced by `encodeEventCursor`. Returns `null` on invalid input. */
export function decodeEventCursor(raw: string | null | undefined): EventCursor | null {
  if (!raw || raw.length > 300) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [iso, id] = value;
    if (typeof iso !== "string" || !z.iso.datetime({ offset: true }).safeParse(iso).success || typeof id !== "string" || !id.trim() || id.length > 191) return null;
    const createdAt = new Date(iso);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Parse `?after=<cursor>&afterId=<id>` from query params.
 *
 * Two forms are supported:
 * 1. `after=<base64url cursor>` — cursor from a previous response.
 * 2. `after=<ISO timestamp>&afterId=<id>` — explicit position (convenient for
 *    manual calls; id breaks ties when two events share a timestamp).
 *
 * Returns `null` when no cursor is present, or `"invalid"` when the cursor is
 * malformed so the caller can return a 400.
 */
export function parseEventCursor(
  params: URLSearchParams,
): EventCursor | null | "invalid" {
  const after = params.get("after");
  const afterId = params.get("afterId");

  if (after === null && afterId === null) return null;
  if (!after) return "invalid";

  // If afterId is provided, treat `after` as an ISO timestamp.
  if (afterId !== null) {
    const createdAt = new Date(after);
    if (!z.iso.datetime({ offset: true }).safeParse(after).success || !afterId.trim() || afterId.length > 191) return "invalid";
    return { createdAt, id: afterId };
  }

  // Otherwise try to decode it as a cursor blob.
  const cursor = decodeEventCursor(after);
  return cursor ?? "invalid";
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const eventSelect = {
  id: true,
  type: true,
  payload: true,
  actorAgentId: true,
  bugId: true,
  createdAt: true,
} satisfies Prisma.AgentEventSelect;

export type AgentEventRow = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  actorAgentId: string | null;
  bugId: string | null;
  createdAt: Date;
};

/**
 * Fetch events for `agent.tenantId` that come after `cursor`, in ascending
 * order (oldest first). Reads 101 rows so the route can detect another page.
 */
export async function listEvents(
  agent: Pick<AgentContext, "tenantId">,
  cursor: EventCursor | null,
): Promise<AgentEventRow[]> {
  const where: Prisma.AgentEventWhereInput = {
    tenantId: agent.tenantId,
    ...(cursor
      ? {
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        }
      : {}),
  };
  return prisma.agentEvent.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 101,
    select: eventSelect,
  });
}

/**
 * Long-poll implementation: wait up to `waitSeconds` for at least one new
 * event after `cursor`, polling the DB every `pollIntervalMs` ms.
 *
 * Returns immediately when events are already available.
 */
export async function pollEvents(
  agent: Pick<AgentContext, "tenantId">,
  cursor: EventCursor | null,
  waitSeconds: number,
  pollIntervalMs = EVENT_POLL_INTERVAL_MS,
): Promise<AgentEventRow[]> {
  const wait = Number.isFinite(waitSeconds) ? Math.max(0, Math.min(waitSeconds, EVENT_MAX_WAIT_SECONDS)) : 0;
  const deadline = Date.now() + wait * 1000;

  for (let attempt = 0; ; attempt += 1) {
    const rows = await listEvents(agent, cursor);
    if (rows.length > 0 || Date.now() >= deadline) return rows;
    // Sleep for one interval, but don't overshoot the deadline.
    const remaining = deadline - Date.now();
    if (remaining <= 0) return rows;
    const delay = pollIntervalMs === EVENT_POLL_INTERVAL_MS
      ? nextPollDelayMs(attempt)
      : pollIntervalMs;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, remaining)));
  }
}
