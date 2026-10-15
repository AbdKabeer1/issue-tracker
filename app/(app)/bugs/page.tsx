import Link from "next/link";
import { Suspense } from "react";
import type { Prisma, Severity, Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { BugFilters } from "@/components/bug-filters";
import { VoteButton } from "@/components/vote-button";
import { Badge } from "@/components/ui/badge";
import {
  severityClass,
  severityLabels,
  statusClass,
  statusLabels,
} from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { severities, statuses } from "@/lib/validations/bug";
import { UserNameWithBadges } from "@/components/user-name-with-badges";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  severity?: string;
}>;

function isStatus(value: string | undefined): value is Status {
  return !!value && (statuses as readonly string[]).includes(value);
}

function isSeverity(value: string | undefined): value is Severity {
  return !!value && (severities as readonly string[]).includes(value);
}

export default async function BugsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await resolveSessionUserId();
  const userId = "userId" in resolved ? resolved.userId : undefined;
  const params = await searchParams;
  const where: Prisma.BugWhereInput = {};

  if (isStatus(params.status)) {
    where.status = params.status;
  }
  if (isSeverity(params.severity)) {
    where.severity = params.severity;
  }
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const bugs = await prisma.bug.findMany({
    where,
    include: {
      reporter: { select: { name: true, role: true } },
      assignee: { select: { name: true, role: true } },
      votes: userId
        ? { where: { userId }, select: { id: true }, take: 1 }
        : false,
    },
    orderBy: [{ voteCount: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bugs</h1>
          <p className="text-sm text-slate-600">
            {bugs.length} result{bugs.length === 1 ? "" : "s"} · sorted by votes
          </p>
        </div>
        <Link
          href="/bugs/new"
          className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Report bug
        </Link>
      </div>

      <Suspense
        fallback={<div className="h-12 animate-pulse rounded-lg bg-slate-100" />}
      >
        <BugFilters />
      </Suspense>

      {bugs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-800">No bugs match these filters.</p>
          <p className="mt-1 text-sm text-slate-600">
            Try clearing filters or report a new issue.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/bugs"
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              Clear filters
            </Link>
            <Link
              href="/bugs/new"
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Report bug
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {bugs.map((bug) => {
            const voted =
              Array.isArray(bug.votes) && bug.votes.length > 0;
            return (
              <li
                key={bug.id}
                className="flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50"
              >
                <VoteButton
                  bugId={bug.id}
                  voteCount={bug.voteCount}
                  voted={voted}
                />
                <Link href={`/bugs/${bug.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900">{bug.title}</p>
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500">
                        <span>Reported by</span>
                        <UserNameWithBadges
                          name={bug.reporter.name}
                          role={bug.reporter.role}
                        />
                        <span>·</span>
                        {bug.assignee ? (
                          <>
                            <span>Assigned to</span>
                            <UserNameWithBadges
                              name={bug.assignee.name}
                              role={bug.assignee.role}
                            />
                          </>
                        ) : (
                          <span>Unassigned</span>
                        )}
                        <span>· {formatDate(bug.updatedAt)}</span>
                        {bug.proofLinks.length > 0 ? (
                          <span>
                            · {bug.proofLinks.length} proof link
                            {bug.proofLinks.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={statusClass[bug.status]}>
                        {statusLabels[bug.status]}
                      </Badge>
                      <Badge className={severityClass[bug.severity]}>
                        {severityLabels[bug.severity]}
                      </Badge>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
