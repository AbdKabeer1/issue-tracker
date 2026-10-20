import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Webhook subscription limits (#512).
 *
 * Each subscription can multiply outbound traffic, so an agent may keep at
 * most `MAX_SUBSCRIPTIONS_PER_AGENT` of them, the same URL only once, and may
 * narrow deliveries to some event types (`events`; empty means every event).
 */

export const MAX_SUBSCRIPTIONS_PER_AGENT = 3;

type Db = PrismaClient | Prisma.TransactionClient;

export type SubscribedWebhook = {
  id: string;
  url: string;
  enabled: boolean;
  createdAt: Date;
  events: string[];
};

export type CreateSubscriptionResult =
  | { ok: true; subscription: SubscribedWebhook }
  | { ok: false; status: 409; error: string };

/** Trim, drop blanks and duplicate event names. `[]` means "all events". */
export function normalizeSubscriptionEvents(events: readonly string[] | undefined): string[] {
  if (!events) return [];
  return [...new Set(events.map((event) => event.trim()).filter(Boolean))];
}

export async function createSubscriptionRecord(
  db: Db,
  params: {
    agentId: string;
    url: string;
    events: string[];
    signingSecretEncrypted: string;
  },
): Promise<CreateSubscriptionResult> {
  const [existingCount, duplicate] = await Promise.all([
    db.webhookSubscription.count({ where: { agentId: params.agentId } }),
    db.webhookSubscription.findFirst({
      where: { agentId: params.agentId, url: params.url },
      select: { id: true },
    }),
  ]);
  if (duplicate) {
    return { ok: false, status: 409, error: "That URL is already subscribed for this agent." };
  }
  if (existingCount >= MAX_SUBSCRIPTIONS_PER_AGENT) {
    return {
      ok: false,
      status: 409,
      error: `An agent can have at most ${MAX_SUBSCRIPTIONS_PER_AGENT} webhook subscriptions. Delete one first.`,
    };
  }

  const subscription = await db.webhookSubscription.create({
    data: {
      agentId: params.agentId,
      url: params.url,
      events: params.events,
      signingSecretEncrypted: params.signingSecretEncrypted,
    },
    select: { id: true, url: true, enabled: true, createdAt: true, events: true },
  });
  return { ok: true, subscription };
}
