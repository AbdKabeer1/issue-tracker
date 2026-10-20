import { describe, expect, it } from "vitest";
import {
  assertIndependentReviewer,
  ReviewerNotIndependentError,
  reviewerConflict,
  type ReviewedBug,
} from "./independence";

const alice = "user-alice";
const bob = "user-bob";
const carol = "user-carol";

const aliceAgentA = { id: "agent-alice-a", ownerUserId: alice };
const aliceAgentB = { id: "agent-alice-b", ownerUserId: alice };
const bobAgent = { id: "agent-bob", ownerUserId: bob };

/** A ticket filed by Alice's agent A, for Carol. */
const filedByAliceAgent: ReviewedBug = {
  beneficiaryUserId: carol,
  createdByAgent: { ownerUserId: alice },
  claims: [],
};

describe("assertIndependentReviewer (#442)", () => {
  it("rejects a second agent of the creator's owner", () => {
    expect(reviewerConflict(aliceAgentB, filedByAliceAgent)).toBe("created-by-own-agent");
    expect(() => assertIndependentReviewer(aliceAgentB, filedByAliceAgent)).toThrow(
      ReviewerNotIndependentError,
    );
  });

  it("rejects the creating agent itself", () => {
    expect(reviewerConflict(aliceAgentA, filedByAliceAgent)).toBe("created-by-own-agent");
  });

  it("allows an agent owned by someone else", () => {
    expect(reviewerConflict(bobAgent, filedByAliceAgent)).toBeNull();
    expect(() => assertIndependentReviewer(bobAgent, filedByAliceAgent)).not.toThrow();
  });

  it("rejects the beneficiary's own agent", () => {
    const forBob: ReviewedBug = { beneficiaryUserId: bob, createdByAgent: null };
    expect(reviewerConflict(bobAgent, forBob)).toBe("own-ticket");
    expect(() => assertIndependentReviewer(bobAgent, forBob)).toThrow(/for the agent's owner/);
  });

  it("rejects an agent whose owner holds the active claim", () => {
    const claimedByAlice: ReviewedBug = {
      beneficiaryUserId: carol,
      claims: [{ status: "active", releasedAt: null, agent: { ownerUserId: alice } }],
    };
    expect(reviewerConflict(aliceAgentB, claimedByAlice)).toBe("claimed-by-own-agent");
  });

  it("ignores released and offered claims", () => {
    const pastClaims: ReviewedBug = {
      beneficiaryUserId: carol,
      claims: [
        { status: "released", releasedAt: new Date(), agent: { ownerUserId: alice } },
        { status: "offered", agent: { ownerUserId: alice } },
        { status: "active", releasedAt: new Date(), agent: { ownerUserId: alice } },
      ],
    };
    expect(reviewerConflict(aliceAgentB, pastClaims)).toBeNull();
  });

  it("allows review of a human-filed ticket for someone else", () => {
    expect(reviewerConflict(bobAgent, { beneficiaryUserId: carol })).toBeNull();
  });

  it("names the conflict on the error", () => {
    try {
      assertIndependentReviewer(aliceAgentB, filedByAliceAgent);
      expect.unreachable();
    } catch (error) {
      expect((error as ReviewerNotIndependentError).conflict).toBe("created-by-own-agent");
    }
  });
});
