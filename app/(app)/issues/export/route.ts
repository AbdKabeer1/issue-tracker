import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bugInTenant, currentTenantIdFor } from "@/lib/tenant-context";
import { activeProjectIdFor } from "@/lib/project-context";
import { getIssueTypes, getPlatforms } from "@/lib/lookups";
import { auth } from "@/auth";
import { requireUser } from "@/lib/auth-helpers";
import { canDeleteTicket } from "@/lib/ticket-deletion";
import { currentTenantAccess } from "@/lib/tenant-access";
import { getBugOrderBy } from "@/lib/issues-sort";
import { parseBugListFilters, type RawParams } from "@/lib/issue-list-filters";
import { CSV_EOL, csvRow } from "@/lib/csv";
import { severityLabel, statusLabel } from "@/lib/labels";

/**
 * Hard ceiling on one export. Without it a single click can walk the whole
 * table; the file says so on its last line when it is reached, because a
 * truncated spreadsheet that looks complete is worse than no spreadsheet.
 */
const EXPORT_LIMIT = 10_000;

/** Rows fetched per round trip while streaming. */
const PAGE = 500;

const COLUMNS = [
  "id",
  "title",
  "status",
  "severity",
  "type",
  "platform",
  "area",
  "reporter",
  "assignee",
  "votes",
  "boosted",
  "created_at",
  "updated_at",
] as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const user = await requireUser();
  const access = await currentTenantAccess(user.id, user.role);

  const params: RawParams = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );

  const tenantId = await currentTenantIdFor(user.id);
  const projectId = await activeProjectIdFor(prisma, tenantId);
  const [tagTypes, platforms, milestones, areas] = await Promise.all([
    getIssueTypes(),
    // Every platform in this organization, active or not: a filter on a
    // platform that was since deactivated still has to resolve.
    getPlatforms(tenantId),
    prisma.milestone.findMany({ select: { id: true } }),
    params.area && projectId
      ? prisma.projectArea.findMany({ where: { projectId }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const { where: filters, sort, mine } = parseBugListFilters({
    params,
    userId: user.id,
    // Deleted issues are admin-only on the list, and must stay admin-only
    // here: an export is just another way of reading the same rows.
    canSeeDeleted: canDeleteTicket(user.role, access.membershipRole),
    tagTypes,
    platforms,
    areas,
    milestones,
  });

  // #425: only the viewer's tenant, exactly as on the list.
  const where = {
    ...filters,
    ...bugInTenant(tenantId),
    ...(projectId ? { projectId } : {}),
  };
  const orderBy = getBugOrderBy(sort, { boostFirst: mine !== "watching" });

  const encoder = new TextEncoder();
  let sent = 0;
  let cursor: string | undefined;
  let done = false;

  // One batch per pull, so the stream respects backpressure: a slow client
  // stops us fetching rather than letting the whole table pile up in memory.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(csvRow(COLUMNS)));
    },
    async pull(controller) {
      if (done) return;
      try {
        const batch = await prisma.bug.findMany({
          where,
          // The sort can tie — several issues with the same vote count and
          // timestamp — and a cursor walk over a non-unique order can repeat
          // or skip rows. Appending id makes the order total.
          orderBy: [...orderBy, { id: "asc" }],
          take: Math.min(PAGE, EXPORT_LIMIT - sent),
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            voteCount: true,
            isBoosted: true,
            createdAt: true,
            updatedAt: true,
            type: { select: { name: true } },
            category: { select: { name: true } },
            area: { select: { name: true } },
            reporter: { select: { name: true } },
            assignee: { select: { name: true } },
          },
        });

        for (const bug of batch) {
          controller.enqueue(
            encoder.encode(
              csvRow([
                bug.id,
                bug.title,
                statusLabel[bug.status],
                severityLabel[bug.severity],
                bug.type?.name,
                bug.category?.name,
                bug.area?.name,
                bug.reporter.name,
                bug.assignee?.name,
                bug.voteCount,
                bug.isBoosted,
                bug.createdAt,
                bug.updatedAt,
              ]),
            ),
          );
        }

        sent += batch.length;
        cursor = batch.at(-1)?.id;

        if (batch.length === 0 || batch.length < PAGE || sent >= EXPORT_LIMIT) {
          done = true;
          if (sent >= EXPORT_LIMIT) {
            const total = await prisma.bug.count({ where });
            if (total > sent) {
              // A truncated spreadsheet that looks complete is worse than no
              // spreadsheet, so say so inside the file itself.
              controller.enqueue(
                encoder.encode(
                  `# Truncated at ${EXPORT_LIMIT} of ${total} issues. Narrow the filter and export again.${CSV_EOL}`,
                ),
              );
            }
          }
          controller.close();
        }
      } catch (error) {
        console.error("[export] failed mid-stream", error);
        // The response is already a 200 carrying part of the file, so the
        // only honest signal left is a line inside it.
        done = true;
        controller.enqueue(
          encoder.encode(`# Export failed partway through. Please try again.${CSV_EOL}`),
        );
        controller.close();
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zedu-issues-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
