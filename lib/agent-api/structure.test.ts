import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatStructuredDescription,
  inferPlatform,
  inferType,
  structureIssue,
} from "./structure";
import type { AgentContext } from "@/lib/agents/require-agent";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    issueType: {
      findMany: vi.fn(),
    },
    issueValidation: {
      upsert: vi.fn(),
    },
    bugActivity: {
      create: vi.fn(),
    },
    agentEvent: {
      create: vi.fn(),
    },
    agentAuditEvent: {
      create: vi.fn(),
    },
    webhookSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        bug: {
          update: vi.fn().mockResolvedValue({ id: "bug-1" }),
        },
        issueValidation: {
          upsert: vi.fn().mockResolvedValue({ id: "val-1" }),
        },
        bugActivity: {
          create: vi.fn().mockResolvedValue({ id: "act-1" }),
        },
        agentEvent: {
          create: vi.fn().mockResolvedValue({ id: "event-1" }),
        },
        agentAuditEvent: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
        webhookSubscription: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });
    }),
  },
}));

vi.mock("@/lib/agent-api/issues", () => ({
  IssueApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
  readAgentIssue: vi.fn().mockResolvedValue({
    id: "bug-1",
    title: "Structured Title",
    description: "Structured description",
    categoryId: "cat-mobile",
    typeId: "type-bug",
  }),
}));

vi.mock("@/lib/agent-api/create-policy", () => ({
  findSimilarIssues: vi.fn().mockResolvedValue([
    {
      id: "bug-existing",
      number: 10,
      title: "Similar login crash",
      status: "open",
      voteCount: 2,
    },
  ]),
}));

vi.mock("@/lib/agents/audit", () => ({
  audit: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("@/lib/agent-api/events", () => ({
  publish: vi.fn().mockResolvedValue({ id: "event-1" }),
}));

import { prisma } from "@/lib/prisma";

const mockAgent: AgentContext = {
  agentId: "agent-1",
  keyId: "key-1",
  tenantId: "tenant-1",
  ownerId: "user-1",
  level: "contributor",
  name: "TriageBot",
  burst: true,
};

describe("Agent structuring heuristics", () => {
  const categories = [
    { id: "cat-mobile", name: "Mobile" },
    { id: "cat-web", name: "Web" },
    { id: "cat-desktop", name: "Desktop" },
  ];

  const types = [
    { id: "type-bug", name: "Bug" },
    { id: "type-feature", name: "Feature" },
  ];

  it("infers platform from keyword associations", () => {
    expect(inferPlatform("App crashes on iPhone 15 Pro", categories)).toBe("cat-mobile");
    expect(inferPlatform("Chrome browser throws blank screen", categories)).toBe("cat-web");
    expect(inferPlatform("Windows installer fails to start", categories)).toBe("cat-desktop");
    expect(inferPlatform("Something broke here", categories)).toBeNull();
  });

  it("infers issue type from problem or request keywords", () => {
    expect(inferType("Critical crash on startup", types)).toBe("type-bug");
    expect(inferType("Feature request: add export to CSV", types)).toBe("type-feature");
    expect(inferType("General observation", types)).toBeNull();
  });

  it("formats structured description markdown cleanly", () => {
    const formatted = formatStructuredDescription({
      stepsToReproduce: "1. Open app\n2. Click login",
      expectedBehavior: "User is logged in",
      actualBehavior: "App crashes",
      environment: "iOS 18, Safari",
    });

    expect(formatted).toContain("### Steps to Reproduce\n1. Open app\n2. Click login");
    expect(formatted).toContain("### Expected Behavior\nUser is logged in");
    expect(formatted).toContain("### Actual Behavior\nApp crashes");
    expect(formatted).toContain("### Environment\niOS 18, Safari");
  });
});

const db = prisma as unknown as {
  bug: { findFirst: ReturnType<typeof vi.fn> };
  category: { findMany: ReturnType<typeof vi.fn> };
  issueType: { findMany: ReturnType<typeof vi.fn> };
};

describe("structureIssue execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.category.findMany.mockResolvedValue([
      { id: "cat-mobile", name: "Mobile" },
      { id: "cat-web", name: "Web" },
    ]);
    db.issueType.findMany.mockResolvedValue([
      { id: "type-bug", name: "Bug" },
      { id: "type-feature", name: "Feature" },
    ]);
  });

  it("structures an incoming human report with duplicate check and inferred metadata", async () => {
    db.bug.findFirst.mockResolvedValue({
      id: "bug-1",
      title: "Login issue",
      description: "When I click login on mobile it crashes",
      projectId: "proj-1",
      tenantId: "tenant-1",
      categoryId: null,
      typeId: null,
      duplicateOfId: null,
      status: "open",
    });

    const result = await structureIssue(mockAgent, "proj-1", "bug-1", {
      title: "Login crashes on mobile",
      stepsToReproduce: "1. Tap login",
      expectedBehavior: "Sign in completes",
      actualBehavior: "Immediate crash",
      environment: "iPhone 15",
      checkDuplicates: true,
    });

    expect(result.ok).toBe(true);
    expect(result.structured).toBe(true);
    expect(result.potentialDuplicates.length).toBe(1);
    expect(result.inferred.categoryId).toBe("cat-mobile");
    expect(result.inferred.typeId).toBe("type-bug");
  });
});
