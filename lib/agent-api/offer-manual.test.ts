import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  bug: { findFirst: vi.fn() },
  issueClaim: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
const isConfirmed = vi.hoisted(() => vi.fn());
const notifyClaimOffered = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agent-api/validation", () => ({ isConfirmed }));
vi.mock("@/lib/agent-notifications", () => ({ notifyClaimOffered }));
vi.mock("@/lib/redesigns", () => ({ assertRedesignOpen: vi.fn() }));

import { offerIssue } from "./offer";

const agent = {
  agentId: "agent-ada",
  name: "Ada's Claude",
  ownerId: "ada",
  tenantId: "tenant",
  level: "contributor" as const,
  burst: false,
  keyId: "key-ada",
};

const pendingOffer = {
  id: "claim-existing",
  bugId: "bug-1",
  agentId: "agent-bob",
  beneficiaryUserId: "bob",
  status: "offered",
  offeredAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$queryRaw.mockResolvedValue([{ id: "bug-1" }]);
  db.$transaction.mockImplementation((run: (tx: unknown) => unknown) => run(db));
  db.bug.findFirst.mockResolvedValue({
    id: "bug-1",
    title: "Example",
    projectId: "project-1",
    status: "open",
    assigneeId: null,
    voteCount: 3,
  });
  db.issueClaim.findFirst.mockResolvedValue(pendingOffer);
  isConfirmed.mockResolvedValue(true);
});

describe("manual issue offers (#590)", () => {
  it("returns an existing pending offer instead of creating another one", async () => {
    const result = await offerIssue(agent, "project-1", "bug-1");

    expect(result).toBe(pendingOffer);
    expect(db.issueClaim.create).not.toHaveBeenCalled();
    expect(db.issueClaim.update).not.toHaveBeenCalled();
    expect(notifyClaimOffered).not.toHaveBeenCalled();
  });
});
