import { EventEmitter } from "node:events";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), check: vi.fn() }));
const db = vi.hoisted(() => ({
  webhookDelivery: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  webhookSubscription: { update: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("node:https", () => ({ request: mocks.request }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("./ssrf", async (original) => ({ ...await original<typeof import("./ssrf")>(), checkSsrf: mocks.check }));
import { attemptDelivery, processDelivery, dispatchDueDeliveries, DELIVERY_TIMEOUT_MS } from "./deliver";
import { encryptSigningSecret } from "./sign";

let status: number | null;
let req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
const options = { url: "https://receiver.test/hook", resolvedAddress: "93.184.216.34", rawSecret: "test-secret", eventId: "event-a", body: '{"message":"hello"}', now: 123456 };
function delivery(attemptCount = 0) {
  return { id: "delivery-a", attemptCount, subscription: {
    id: "subscription-a", enabled: true, url: options.url, signingSecretEncrypted: encryptSigningSecret(options.rawSecret),
    events: [],
    agent: { tenantId: "tenant-a", revokedAt: null, owner: { memberships: [{ tenantId: "tenant-a" }] } },
  }, event: { id: "event-a", tenantId: "tenant-a", type: "issue.created", payload: { issueId: "issue-a" }, actorAgentId: "agent-a", bugId: "issue-a", createdAt: new Date(0) } };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("WEBHOOK_SECRET_KEY", "a".repeat(64));
  status = 200;
  mocks.request.mockImplementation((_url, _options, callback) => {
    req = Object.assign(new EventEmitter(), { end: vi.fn(() => {
      if (status !== null) queueMicrotask(() => callback({ statusCode: status, destroy: vi.fn() }));
    }), destroy: vi.fn() });
    return req;
  });
  mocks.check.mockResolvedValue({ ok: true, address: options.resolvedAddress });
  db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
  db.webhookDelivery.findUnique.mockResolvedValue(delivery());
  db.webhookSubscription.update.mockResolvedValue({ failureCount: 1 });
  db.$transaction.mockImplementation((run) => run(db));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("pinned HTTPS transport", () => {
  it("connects to the checked IP and signs the exact transmitted bytes", async () => {
    expect(await attemptDelivery(options)).toEqual({ ok: true });
    const [url, transport] = mocks.request.mock.calls[0];
    expect(url.hostname).toBe("receiver.test");
    expect(transport.agent).toBe(false);
    const callback = vi.fn();
    transport.lookup("receiver.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, options.resolvedAddress, 4);
    transport.lookup("receiver.test", { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: options.resolvedAddress, family: 4 }]);
    expect(transport.headers).toMatchObject({
      "X-Ziki-Delivery": "event-a", "X-Ziki-Timestamp": "123456",
      "X-Ziki-Signature": createHmac("sha256", options.rawSecret).update(`123456.${options.body}`).digest("hex"),
    });
    expect(req.end).toHaveBeenCalledWith(options.body);
  });
  it("does not follow redirects or send to an unvalidated IP literal", async () => {
    status = 302;
    expect((await attemptDelivery(options)).ok).toBe(false);
    mocks.request.mockClear();
    expect((await attemptDelivery({ ...options, url: "https://127.0.0.1/" })).ok).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("enforces the ten-second overall network deadline", async () => {
    vi.useFakeTimers();
    status = null;
    const pending = attemptDelivery(options);
    await vi.advanceTimersByTimeAsync(DELIVERY_TIMEOUT_MS);
    expect(await pending).toEqual({ ok: false, error: "Webhook delivery timed out." });
    expect(req.destroy).toHaveBeenCalled();
  });
});

describe("durable delivery attempts", () => {
  it("marks success delivered and resets the subscription failure streak", async () => {
    await processDelivery("delivery-a");
    expect(mocks.check).toHaveBeenCalledWith(options.url);
    expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "delivered", attemptCount: 1, nextAttemptAt: null }) }));
    expect(db.webhookSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { failureCount: 0 } }));
  });
  it("retries with exponential backoff then disables the subscription and marks pending deliveries dead", async () => {
    vi.useFakeTimers();
    status = 500;
    const now = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      db.webhookDelivery.findUnique.mockResolvedValueOnce(delivery(attempt));
      db.webhookSubscription.update.mockResolvedValueOnce({ failureCount: attempt + 1 });
      await processDelivery("delivery-a");
      const updates = db.webhookDelivery.updateMany.mock.calls.map(([input]) => input.data);
      expect(updates).toContainEqual(expect.objectContaining({ attemptCount: attempt + 1, status: attempt === 4 ? "dead" : "pending", nextAttemptAt: attempt === 4 ? null : new Date(now + 1000 * 2 ** attempt) }));
    }
    expect(db.webhookSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ enabled: false }) }));
    expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { subscriptionId: "subscription-a", status: "pending" }, data: { status: "dead", nextAttemptAt: null } }));
  });
  it("does not take a live lease or resend a delivered row", async () => {
    db.webhookDelivery.updateMany.mockResolvedValueOnce({ count: 0 });
    await processDelivery("delivery-a");
    expect(db.webhookDelivery.findUnique).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "pending", OR: expect.any(Array) }) }));
  });
  it("does not send events outside the subscription filter (#512)", async () => {
    const filtered = delivery();
    (filtered.subscription as { events?: string[] }).events = ["issue.created"];
    filtered.event.type = "comment.created";
    db.webhookDelivery.findUnique.mockResolvedValue(filtered);

    await processDelivery("delivery-a");

    expect(mocks.request).not.toHaveBeenCalled();
    expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "dead" }),
    }));
  });

  it("rejects DNS rebinding and revoked agent access without making a request", async () => {
    mocks.check.mockResolvedValueOnce({ ok: false });
    await processDelivery("delivery-a");
    expect(mocks.request).not.toHaveBeenCalled();
    const revoked = delivery();
    revoked.subscription.agent.owner.memberships = [];
    db.webhookDelivery.findUnique.mockResolvedValueOnce(revoked);
    await processDelivery("delivery-a");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("only selects due pending rows in bounded batches", async () => {
    db.webhookDelivery.findMany.mockResolvedValue([]);
    expect(await dispatchDueDeliveries()).toBe(0);
    expect(db.webhookDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, where: expect.objectContaining({ status: "pending" }) }));
  });
});
