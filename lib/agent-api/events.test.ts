import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock prisma before imports
// ---------------------------------------------------------------------------
const db = vi.hoisted(() => ({
  agentEvent: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  encodeEventCursor,
  decodeEventCursor,
  parseEventCursor,
  parseEventFilters,
  listEvents,
  publish,
  AGENT_EVENT_TYPES,
  type EventCursor,
} from "./events";

// ---------------------------------------------------------------------------
// Cursor encode / decode
// ---------------------------------------------------------------------------

describe("event cursor encode/decode", () => {
  const cursor: EventCursor = {
    createdAt: new Date("2026-10-19T10:00:00.000Z"),
    id: "evt-abc",
  };

  it("round-trips a cursor without data loss", () => {
    const encoded = encodeEventCursor(cursor);
    const decoded = decodeEventCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(cursor.id);
    expect(decoded!.createdAt.toISOString()).toBe(cursor.createdAt.toISOString());
  });

  it("returns null for garbage input", () => {
    expect(decodeEventCursor(null)).toBeNull();
    expect(decodeEventCursor("")).toBeNull();
    expect(decodeEventCursor("not-base64")).toBeNull();
    expect(decodeEventCursor("YWJj")).toBeNull(); // valid base64 but bad JSON structure
  });

  it("handles two events at the same timestamp via id ordering", () => {
    const c1: EventCursor = { createdAt: new Date("2026-10-19T10:00:00.000Z"), id: "aaa" };
    const c2: EventCursor = { createdAt: new Date("2026-10-19T10:00:00.000Z"), id: "zzz" };
    const d1 = decodeEventCursor(encodeEventCursor(c1));
    const d2 = decodeEventCursor(encodeEventCursor(c2));
    expect(d1!.id).toBe("aaa");
    expect(d2!.id).toBe("zzz");
    // Both decode to the same timestamp — the id is what breaks the tie.
    expect(d1!.createdAt.toISOString()).toBe(d2!.createdAt.toISOString());
  });
});

// ---------------------------------------------------------------------------
// parseEventCursor
// ---------------------------------------------------------------------------

describe("parseEventCursor", () => {
  it("returns null when no after param is present", () => {
    expect(parseEventCursor(new URLSearchParams(""))).toBeNull();
  });

  it("decodes a base64url cursor blob", () => {
    const cursor: EventCursor = { createdAt: new Date("2026-10-19T10:00:00.000Z"), id: "evt-1" };
    const encoded = encodeEventCursor(cursor);
    const params = new URLSearchParams({ after: encoded });
    const result = parseEventCursor(params);
    expect(result).not.toBeNull();
    expect(result).not.toBe("invalid");
    if (result && result !== "invalid") {
      expect(result.id).toBe("evt-1");
    }
  });

  it("accepts an ISO timestamp + afterId pair", () => {
    const params = new URLSearchParams({
      after: "2026-10-19T10:00:00.000Z",
      afterId: "evt-2",
    });
    const result = parseEventCursor(params);
    expect(result).not.toBeNull();
    expect(result).not.toBe("invalid");
    if (result && result !== "invalid") {
      expect(result.id).toBe("evt-2");
    }
  });

  it("returns invalid for a bad cursor blob", () => {
    expect(parseEventCursor(new URLSearchParams({ after: "bad!!" }))).toBe("invalid");
  });

  it("returns invalid for a bad timestamp with afterId", () => {
    expect(parseEventCursor(new URLSearchParams({ after: "not-a-date", afterId: "evt-3" }))).toBe("invalid");
  });
});

// ---------------------------------------------------------------------------
// parseEventFilters (#602)
// ---------------------------------------------------------------------------

describe("parseEventFilters", () => {
  it("returns no filters when none are given", () => {
    expect(parseEventFilters(new URLSearchParams())).toEqual({});
  });

  it("splits exact types and prefixes, trimming and deduping", () => {
    expect(parseEventFilters(new URLSearchParams({ types: "comment.created, claim.*,comment.created,," })))
      .toEqual({ types: ["comment.created"], typePrefixes: ["claim."] });
  });

  it("reads projectId and bugId", () => {
    expect(parseEventFilters(new URLSearchParams({ projectId: "proj-1", bugId: "bug-1" })))
      .toEqual({ projectId: "proj-1", bugId: "bug-1" });
  });

  it("rejects unknown types and lists the valid ones", () => {
    for (const types of ["nope", "comment.created,issue.nope", "*", ".*", "nope.*", "claim", ""]) {
      const result = parseEventFilters(new URLSearchParams({ types }));
      expect(result, types).toMatchObject({ validTypes: AGENT_EVENT_TYPES });
      expect("error" in result && result.error, types).toBeTruthy();
    }
    expect(parseEventFilters(new URLSearchParams({ types: "comment.created,issue.nope" })))
      .toMatchObject({ error: "Unknown event type: issue.nope." });
  });

  it("rejects blank or oversized ids", () => {
    expect(parseEventFilters(new URLSearchParams({ projectId: " " }))).toEqual({ error: "Invalid projectId." });
    expect(parseEventFilters(new URLSearchParams({ bugId: "x".repeat(192) }))).toEqual({ error: "Invalid bugId." });
  });
});

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

describe("listEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches events for the agent's tenant with no cursor", async () => {
    db.agentEvent.findMany.mockResolvedValue([]);
    await listEvents({ tenantId: "tenant-a" }, null);
    expect(db.agentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 101,
      }),
    );
  });

  it("applies a (createdAt, id) cursor correctly", async () => {
    db.agentEvent.findMany.mockResolvedValue([]);
    const cursor: EventCursor = { createdAt: new Date("2026-10-19T10:00:00.000Z"), id: "evt-x" };
    await listEvents({ tenantId: "tenant-a" }, cursor);
    expect(db.agentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        },
      }),
    );
  });

  it("combines type, project and issue filters with the cursor (#602)", async () => {
    db.agentEvent.findMany.mockResolvedValue([]);
    const cursor: EventCursor = { createdAt: new Date("2026-10-19T10:00:00.000Z"), id: "evt-x" };
    await listEvents({ tenantId: "tenant-a" }, cursor, {
      types: ["comment.created"], typePrefixes: ["claim."], projectId: "proj-1", bugId: "bug-1",
    });
    expect(db.agentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          projectId: "proj-1",
          bugId: "bug-1",
          AND: [{ OR: [{ type: { in: ["comment.created"] } }, { type: { startsWith: "claim." } }] }],
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("uses a single type match without an OR", async () => {
    db.agentEvent.findMany.mockResolvedValue([]);
    await listEvents({ tenantId: "tenant-a" }, null, { types: ["issue.created", "issue.updated"] });
    expect(db.agentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a", AND: [{ type: { in: ["issue.created", "issue.updated"] } }] },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

describe("publish", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("only queues deliveries for subscriptions whose event filter matches (#512)", async () => {
    const fakeDb = {
      agentEvent: { create: vi.fn().mockResolvedValue({ id: "new-event" }) },
      webhookSubscription: { findMany: vi.fn().mockResolvedValue([]) },
      webhookDelivery: { createMany: vi.fn() },
    } as unknown as Parameters<typeof publish>[0];

    await publish(fakeDb, { tenantId: "tenant-a", type: "issue.created", payload: {} });

    const where = (fakeDb.webhookSubscription.findMany as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { events: { isEmpty: true } },
      { events: { has: "issue.created" } },
    ]);
  });

  it("creates an AgentEvent row with the given fields", async () => {
    const fakeDb = {
      agentEvent: { create: vi.fn().mockResolvedValue({ id: "new-event" }) },
      webhookSubscription: { findMany: vi.fn().mockResolvedValue([{ id: "subscription-a" }]) },
      webhookDelivery: { createMany: vi.fn() },
    } as unknown as Parameters<typeof publish>[0];

    const result = await publish(fakeDb, {
      tenantId: "tenant-a",
      type: "issue.created",
      payload: { issueId: "bug-1" },
      actorAgentId: "agent-a",
      bugId: "bug-1",
    });

    expect(result.id).toBe("new-event");
    expect(fakeDb.webhookSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      enabled: true, agent: expect.objectContaining({ tenantId: "tenant-a", revokedAt: null }),
    }) }));
    expect(fakeDb.webhookDelivery.createMany).toHaveBeenCalledWith({
      data: [{ subscriptionId: "subscription-a", eventId: "new-event", nextAttemptAt: expect.any(Date) }], skipDuplicates: true,
    });
    expect((fakeDb as typeof fakeDb & { agentEvent: { create: ReturnType<typeof vi.fn> } }).agentEvent.create)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "tenant-a",
            type: "issue.created",
            payload: { issueId: "bug-1" },
            actorAgentId: "agent-a",
            bugId: "bug-1",
          }),
        }),
      );
  });
});
