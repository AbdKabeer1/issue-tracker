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
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { notifyLater } from "@/lib/notify";
import { TICKET_ASSIGN_ERRORS } from "@/lib/ticket-assignment";
import { TICKET_TRIAGE_ERRORS } from "@/lib/ticket-triage";
import { updateBugAction } from "./bugs";

const db = prisma as unknown as {
  bug: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  issueType: { findUnique: ReturnType<typeof vi.fn> };
  category: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockUser = requireUser as unknown as ReturnType<typeof vi.fn>;

type Who = "user" | "admin";
const ME = "cmeuser00000001";
const OTHER = "cotheruser00001";
const SOMEONE = "csomeone0000001";

let written: Record<string, unknown> | null;

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
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ name: where.id }));
  db.issueType.findUnique.mockResolvedValue({ id: "t1", name: "Fix", isActive: true });
  db.category.findUnique.mockResolvedValue({ id: "c1", name: "Web" });
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      bug: { update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (written = data)) },
      bugActivity: { createMany: vi.fn() },
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
