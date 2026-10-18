import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authorization table for updateBugAction (#218): who may change which field
 * of an issue, across role × assignee × self-assigning × field.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyLater: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    issueType: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    milestone: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { notifyLater } from "@/lib/notify";
import { TICKET_ASSIGN_ERRORS } from "@/lib/ticket-assignment";
import { TICKET_TRIAGE_ERRORS } from "@/lib/ticket-triage";
import { updateBugAction } from "./issues";

const db = prisma as unknown as {
  bug: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  issueType: { findUnique: ReturnType<typeof vi.fn> };
  category: { findUnique: ReturnType<typeof vi.fn> };
  milestone: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockUser = requireUser as unknown as ReturnType<typeof vi.fn>;

type Who = "user" | "admin";
const ME = "cmeuser00000001";
const OTHER = "cotheruser00001";
const SOMEONE = "csomeone0000001";

let written: Record<string, unknown> | null;
let activities: string[] = [];

function issue(assigneeId: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: "bug1",
    title: "A bug",
    status: "open",
    severity: "medium",
    typeId: null,
    categoryId: null,
    assigneeId,
    reporterId: "reporter",
    isDeleted: false,
    assignee: assigneeId ? { id: assigneeId, name: assigneeId } : null,
    category: null,
    type: null,
    ...extra,
  };
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

async function run(who: Who, assigneeId: string | null, values: Record<string, string>) {
  mockUser.mockResolvedValue({ id: ME, name: "Me", role: who });
  db.bug.findUnique.mockResolvedValue(issue(assigneeId));
  return updateBugAction("bug1", form(values));
}

beforeEach(() => {
  vi.clearAllMocks();
  written = null;
  activities = [];
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ name: where.id }));
  db.issueType.findUnique.mockResolvedValue({ id: "t1", name: "Fix", isActive: true });
  db.category.findUnique.mockResolvedValue({ id: "c1", name: "Web" });
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      bug: { update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (written = data)) },
      bugActivity: {
        createMany: vi.fn(async ({ data }: { data: Array<{ type: string }> }) => {
          activities = data.map((entry) => entry.type);
        }),
      },
      // Used once assignees auto-watch issues (#216).
      issueWatch: { createMany: vi.fn() },
    }),
  );
});

describe("updateBugAction authorization (#218)", () => {
  it.each([
    // [who, current assignee, form, expected error or null, expected written data]
    ["user", null, { status: "resolved" }, TICKET_TRIAGE_ERRORS.statusUnauthorized, null],
    ["user", OTHER, { status: "resolved" }, TICKET_TRIAGE_ERRORS.statusUnauthorized, null],
    ["user", null, { assigneeId: ME }, null, { assigneeId: ME }],
    ["user", null, { assigneeId: ME, status: "resolved" }, TICKET_TRIAGE_ERRORS.statusUnauthorized, null],
    ["user", null, { assigneeId: ME, status: "open" }, TICKET_TRIAGE_ERRORS.statusUnauthorized, null],
    ["user", OTHER, { assigneeId: ME }, TICKET_ASSIGN_ERRORS.unauthorized, null],
    ["user", ME, { status: "resolved" }, null, { status: "resolved" }],
    ["user", ME, { status: "in_progress", severity: "critical", typeId: "t1", categoryId: "c1" }, null, { status: "in_progress" }],
    ["user", ME, { assigneeId: OTHER }, TICKET_ASSIGN_ERRORS.unauthorized, null],
    ["user", ME, { assigneeId: "" }, null, { assigneeId: null }],
    ["admin", OTHER, { assigneeId: SOMEONE, severity: "critical", status: "closed" }, null, { status: "closed", severity: "critical", assigneeId: SOMEONE }],
    ["admin", null, { typeId: "t1", categoryId: "c1" }, null, { typeId: "t1", categoryId: "c1" }],
  ] as const)(
    "%s on an issue assigned to %s, sending %j → %s",
    async (who, assignee, values, error, data) => {
      const result = await run(who, assignee, { ...values });
      if (error) {
        expect(result).toEqual({ error });
        expect(written).toBeNull();
      } else {
        expect(result).toEqual({ ok: true });
        expect(written).toEqual(data);
      }
    },
  );

  it("refuses to update a deleted issue", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(issue(null, { isDeleted: true }));
    await expect(updateBugAction("bug1", form({ status: "closed" }))).resolves.toEqual({
      error: "Issue not found",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("notifies on assignment and status changes only when something changed", async () => {
    await run("admin", null, { assigneeId: SOMEONE, status: "resolved" });
    const events = (notifyLater as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(events.map((e: { kind: string }) => e.kind)).toEqual(["assignee_changed", "status_changed"]);

    vi.clearAllMocks();
    await run("admin", null, { status: "open" });
    expect(notifyLater).not.toHaveBeenCalled();
  });
});

describe("updateBugAction unboosts finished issues (#256)", () => {
  async function runBoosted(status: string, extra: Record<string, unknown> = {}) {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(
      issue(null, { isBoosted: true, boostedAt: new Date("2026-10-01T00:00:00Z"), ...extra }),
    );
    return updateBugAction("bug1", form({ status }));
  }

  it.each(["resolved", "closed"])("clears the boost and logs it when an issue is %s", async (status) => {
    await expect(runBoosted(status)).resolves.toEqual({ ok: true });
    expect(written).toEqual({ status, isBoosted: false, boostedAt: null });
    expect(activities).toEqual(["status_changed", "unboosted"]);
  });

  it("keeps the boost when a boosted issue moves to in progress", async () => {
    await runBoosted("in_progress");
    expect(written).toEqual({ status: "in_progress" });
    expect(activities).toEqual(["status_changed"]);
  });

  it("leaves a boosted issue alone when its status doesn't change", async () => {
    await runBoosted("closed", { status: "closed" });
    expect(written).toEqual({ status: "closed" });
    expect(activities).toEqual([]);
  });
});

describe("milestones in triage (#289)", () => {
  const withMilestone = (milestoneId: string | null, title: string | null = null) =>
    issue(null, { milestoneId, milestone: milestoneId ? { id: milestoneId, title } : null });

  it("lets an admin put an issue in a milestone, with an activity entry", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(withMilestone(null));
    db.milestone.findUnique.mockResolvedValue({ title: "v2.4", isClosed: false });
    expect(await updateBugAction("bug1", form({ milestoneId: "m1" }))).toEqual({ ok: true });
    expect(written).toEqual({ milestoneId: "m1" });
    expect(activities).toEqual(["milestone_changed"]);
  });

  it("takes it out again with an empty value", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(withMilestone("m1", "v2.4"));
    expect(await updateBugAction("bug1", form({ milestoneId: "" }))).toEqual({ ok: true });
    expect(written).toEqual({ milestoneId: null });
  });

  it("refuses a closed milestone", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(withMilestone(null));
    db.milestone.findUnique.mockResolvedValue({ title: "v2.3", isClosed: true });
    const result = await updateBugAction("bug1", form({ milestoneId: "m0" }));
    expect(result.error).toMatch(/closed/);
    expect(written).toBeNull();
  });

  it("ignores the field from a non-admin", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "user" });
    db.bug.findUnique.mockResolvedValue(issue(ME));
    await updateBugAction("bug1", form({ status: "in_progress", milestoneId: "m1" }));
    expect(written).toEqual({ status: "in_progress" });
    expect(db.milestone.findUnique).not.toHaveBeenCalled();
  });

  it("does nothing when the milestone is unchanged", async () => {
    mockUser.mockResolvedValue({ id: ME, name: "Me", role: "admin" });
    db.bug.findUnique.mockResolvedValue(withMilestone("m1", "v2.4"));
    expect(await updateBugAction("bug1", form({ milestoneId: "m1" }))).toEqual({ ok: true });
    expect(written).toBeNull();
  });
});
