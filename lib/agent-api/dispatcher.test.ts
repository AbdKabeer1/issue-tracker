import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentLevelError } from "@/lib/agents/levels";

const db = vi.hoisted(() => ({
  bug: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  issueBid: { findMany: vi.fn(), count: vi.fn() },
  issueClaim: { update: vi.fn(), count: vi.fn() },
}));
const isConfirmed = vi.hoisted(() => vi.fn());
const offerNext = vi.hoisted(() => vi.fn());
const scheduleOfferExpiry = vi.hoisted(() => vi.fn());
const awardBid = vi.hoisted(() => vi.fn());
const publish = vi.hoisted(() => vi.fn());
const notifyClaimOffered = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agent-api/validation", () => ({ isConfirmed }));
vi.mock("@/lib/agent-api/offer", () => ({ offerNext, scheduleOfferExpiry }));
vi.mock("@/lib/agent-api/bid", () => ({ awardBid }));
vi.mock("@/lib/agent-api/events", () => ({ publish }));
vi.mock("@/lib/agent-notifications", () => ({ notifyClaimOffered }));

import { dispatchReadyIssues, findReadyIssues } from "./dispatcher";

const dispatcher = {
  agentId: "agent-disp",
  name: "Dispatcher",
  ownerId: "owner",
  tenantId: "tenant",
  level: "dispatcher" as const,
  burst: false,
  keyId: "key-disp",
};

const contributor = { ...dispatcher, level: "contributor" as const };

const readyBug = {
  id: "bug-1",
  number: 1,
  title: "Ready",
  projectId: "project-1",
  areaId: null,
  voteCount: 4,
  assigneeId: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.bug.findMany.mockResolvedValue([readyBug]);
  db.issueBid.findMany.mockResolvedValue([]);
  isConfirmed.mockResolvedValue(true);
  offerNext.mockResolvedValue({
    claim: { id: "claim-1", bugId: "bug-1", offeredAt: new Date() },
    bugTitle: "Ready",
    beneficiaryUserId: "bob",
  });
});

describe("findReadyIssues", () => {
  it("requires dispatcher level", async () => {
    await expect(findReadyIssues(contributor, "project-1")).rejects.toBeInstanceOf(AgentLevelError);
  });

  it("returns only confirmed issues at the upvote threshold", async () => {
    isConfirmed.mockResolvedValueOnce(false);
    expect(await findReadyIssues(dispatcher, "project-1")).toEqual([]);
  });
});

describe("dispatchReadyIssues", () => {
  it("requires dispatcher level", async () => {
    await expect(dispatchReadyIssues(contributor, "project-1")).rejects.toBeInstanceOf(AgentLevelError);
  });

  it("offers a ready issue with no bids to the next candidate", async () => {
    const result = await dispatchReadyIssues(dispatcher, "project-1");

    expect(result).toMatchObject({ offered: 1, awarded: 0, skipped: 0, errors: [] });
    expect(offerNext).toHaveBeenCalledOnce();
    expect(notifyClaimOffered).toHaveBeenCalledWith(expect.objectContaining({ bugId: "bug-1" }));
  });

  it("skips issues with pending bids in offer_only mode", async () => {
    db.issueBid.findMany.mockResolvedValue([
      { id: "bid-1", createdAt: new Date(), bug: { reporterId: "reporter" } },
    ]);

    const result = await dispatchReadyIssues(dispatcher, "project-1");

    expect(result).toMatchObject({ offered: 0, awarded: 0, skipped: 1 });
    expect(offerNext).not.toHaveBeenCalled();
    expect(awardBid).not.toHaveBeenCalled();
  });

  it("awards the oldest bid as the reporter in auto_award mode", async () => {
    db.issueBid.findMany.mockResolvedValue([
      { id: "bid-1", createdAt: new Date(), bug: { reporterId: "reporter" } },
    ]);

    const result = await dispatchReadyIssues(dispatcher, "project-1", { policy: "auto_award" });

    expect(result.awarded).toBe(1);
    expect(awardBid).toHaveBeenCalledWith({ id: "reporter" }, "bid-1");
    expect(offerNext).not.toHaveBeenCalled();
  });

  it("skips bids younger than autoAwardAfterHours in auto_award mode", async () => {
    db.issueBid.findMany.mockResolvedValue([
      { id: "bid-1", createdAt: new Date(), bug: { reporterId: "reporter" } },
    ]);

    const result = await dispatchReadyIssues(dispatcher, "project-1", {
      policy: "auto_award",
      autoAwardAfterHours: 24,
    });

    expect(result).toMatchObject({ awarded: 0, skipped: 1 });
    expect(awardBid).not.toHaveBeenCalled();
  });

  it("collects per-issue errors instead of aborting the run", async () => {
    offerNext.mockRejectedValue(new Error("no candidates"));

    const result = await dispatchReadyIssues(dispatcher, "project-1");

    expect(result.offered).toBe(0);
    expect(result.errors).toEqual([{ issueId: "bug-1", error: "no candidates" }]);
  });
});
