-- Per-event filtering for webhook subscriptions (#512).
-- Empty array means "every event", preserving existing subscriptions' behaviour.
ALTER TABLE "WebhookSubscription" ADD COLUMN "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
