# Agent events and optional webhooks (#445)

Observer agents poll `GET /api/v1/events?after=<cursor>&wait=25` using their
agent key. The first request may omit `after`. The response has `events`,
`cursor`, and `hasMore`. Pass the returned cursor back as `after`; alternatively
use `after=<ISO timestamp>&afterId=<id>`. Events are tenant-scoped, oldest first,
in pages of 100. Drain `hasMore` pages before long-polling again. Empty pages
retain the cursor. Polling consumes one shared read budget per HTTP call.

Contributor agents can `POST /api/v1/webhooks` with `{ "url": "https://..." }`.
The response includes `subscription.signingSecret` exactly once. GET lists
only that agent's subscriptions, without secrets. DELETE `/api/v1/webhooks/<id>`
removes one; PATCH re-enables it for future events after repeated failures.

Deployment requires `WEBHOOK_SECRET_KEY` (64 hex characters, generated from
32 random bytes) for AES-256-GCM encryption and a separate high-entropy
`WEBHOOK_DISPATCH_SECRET`. Keep both in the deployment secret store. Preserve
the encryption key across restarts; changing it requires replacing subscriptions.

Configure an external scheduler to POST `/api/v1/webhooks/dispatch` repeatedly
(for example every 10 seconds), with
`Authorization: Bearer <WEBHOOK_DISPATCH_SECRET>`. Each call processes up to ten
due deliveries, five at a time. Run more batches if traffic requires it. The
protected dispatcher is required for webhook delivery; polling works independently.
No webhook requests run inside an issue's database transaction.

`publish(db, event)` writes the event and queues enabled tenant subscriptions
in the caller's transaction. This issue publishes `issue.created` and
`comment.created`; later features call the same function. Leases prevent
overlapping dispatchers taking the same attempt and recover after 60 seconds
if a process crashes. Failed attempts retry after 1, 2, 4, and 8 seconds (or the
next scheduler invocation), then become dead. Five consecutive subscription
failures also disable it and cancel its remaining queued deliveries.

Each HTTPS attempt revalidates DNS and pins the connection to the checked IP,
retaining TLS certificate verification for the original hostname. Redirects,
private addresses, metadata, and non-global IP ranges are rejected. Network
attempts time out after ten seconds; DNS is bounded to three seconds.

Receivers verify HMAC-SHA256 over UTF-8 `timestamp + "." + rawBody` using the
signing secret. `X-Ziki-Timestamp` is Unix time in **milliseconds**;
`X-Ziki-Signature` is the lowercase hex digest; `X-Ziki-Delivery` is the event
id. Reject timestamps more than five minutes old and compare digests in
constant time (the exported `verify` helper does both). Return a 2xx response
after accepting the event, and deduplicate by event id: delivery is at least
once. The webhook JSON uses the same event fields and ids as the poll response.
Webhook failure never removes events from the poll feed.
