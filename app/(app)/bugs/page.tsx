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
import { LocalTime } from "@/components/local-time";
import { severities, statuses } from "@/lib/validations/bug";
import { UserNameWithBadges } from "@/components/user-name-with-badges";
import { getIssueTypeBadgeClass } from "@/lib/issue-types";
import { escapeSearchQuery } from "@/lib/search";
import { calculatePagination } from "@/lib/pagination";
import { PaginationControls } from "@/components/pagination-controls";
import { fetchVoterSummaries } from "@/lib/voter-summaries";
import { createEmptyVoterSummary } from "@/lib/voters";
import { VoterAvatars } from "@/components/voter-avatars";
import {
  bugSortDescriptions,
  getBugOrderBy,
  parseBugSort,
} from "@/lib/bugs-sort";
import { canDeleteTicket } from "@/lib/ticket-deletion";
import { DeleteBugButton } from "@/components/delete-bug-button";
import { canBoostTicket } from "@/lib/ticket-boosting";
import { BoostTicketButton } from "@/components/boost-ticket-button";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  severity?: string;
  sort?: string;
  page?: string;
  [key: string]: string | undefined;
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
  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
    : null;
  const canDelete = canDeleteTicket(currentUser?.role);
  const canBoost = canBoostTicket(currentUser?.role);
  const params = await searchParams;
  const currentSort = parseBugSort(params.sort);
  const where: Prisma.BugWhereInput = {};

  if (isStatus(params.status)) {
    where.status = params.status;
  }
  if (isSeverity(params.severity)) {
    where.severity = params.severity;
  }
  if (params.q?.trim()) {
    const q = escapeSearchQuery(params.q.trim());
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const totalCount = await prisma.bug.count({ where });
  const pagination = calculatePagination({
    page: params.page,
    totalCount,
  });

  const bugs = await prisma.bug.findMany({
    where,
    include: {
      type: { select: { name: true } },
      reporter: { select: { name: true, role: true } },
      assignee: { select: { name: true, role: true } },
      category: { select: { id: true, name: true } },
      votes: userId
        ? { where: { userId }, select: { id: true, value: true }, take: 1 }
        : false,
    },
    orderBy: getBugOrderBy(currentSort),
    skip: pagination.skip,
    take: pagination.take,
  });

  const bugIds = bugs.map((bug) => bug.id);
  const voterSummaries = await fetchVoterSummaries(bugIds);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Bugs</h1>
          <p className="text-sm text-slate-600">
            {totalCount} result{totalCount === 1 ? "" : "s"} · sorted by{" "}
            {bugSortDescriptions[currentSort]}
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
        <>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {bugs.map((bug) => {
            const userVote =
              Array.isArray(bug.votes) && bug.votes.length > 0
                ? (bug.votes[0].value ?? 1)
                : 0;
            const voterSummary =
              voterSummaries.get(bug.id) ?? createEmptyVoterSummary();
            return (
              <li
                key={bug.id}
                className="flex items-start gap-3 px-3 py-3.5 sm:px-4 sm:py-4 transition hover:bg-slate-50"
              >
                <VoteButton
                  bugId={bug.id}
                  voteCount={bug.voteCount}
                  userVote={userVote}
                  likeCount={voterSummary.likes.count}
                  dislikeCount={voterSummary.dislikes.count}
                  size="sm"
                />
                <Link href={`/bugs/${bug.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900 break-words">{bug.title}</p>
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
                        <span>· <LocalTime date={bug.updatedAt} /></span>
                        {bug.proofLinks.length > 0 ? (
                          <span>
                            · {bug.proofLinks.length} proof link
                            {bug.proofLinks.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </p>

                      {/* Compact voter avatars under bug details */}
                      {(voterSummary.likes.count > 0 ||
                        voterSummary.dislikes.count > 0) && (
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                          {voterSummary.likes.count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span>👍 {voterSummary.likes.count}</span>
                              <VoterAvatars
                                voters={voterSummary.likes.voters}
                                totalCount={voterSummary.likes.count}
                                size="sm"
                              />
                            </div>
                          )}
                          {voterSummary.dislikes.count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span>👎 {voterSummary.dislikes.count}</span>
                              <VoterAvatars
                                voters={voterSummary.dislikes.voters}
                                totalCount={voterSummary.dislikes.count}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5 self-start">
                      {bug.isBoosted ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          <span aria-hidden="true">⚡</span> Boosted
                        </span>
                      ) : null}
                      {bug.type ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getIssueTypeBadgeClass(
                            bug.type.name,
                          )}`}
                        >
                          {bug.type.name}
                        </span>
                      ) : null}
                      {bug.category ? (
                        <Badge className="border border-teal-200 bg-teal-50 text-teal-800">
                          {bug.category.name}
                        </Badge>
                      ) : null}
                      <Badge className={statusClass[bug.status]}>
                        {statusLabels[bug.status]}
                      </Badge>
                      <Badge className={severityClass[bug.severity]}>
                        {severityLabels[bug.severity]}
                      </Badge>
                    </div>
                  </div>
                </Link>
                {canBoost || canDelete ? (
                  <div className="flex shrink-0 items-center gap-1 self-center pl-1">
                    {canBoost ? (
                      <BoostTicketButton
                        bugId={bug.id}
                        isBoosted={bug.isBoosted}
                        variant="ghost"
                        size="sm"
                      />
                    ) : null}
                    {canDelete ? (
                      <DeleteBugButton
                        bugId={bug.id}
                        bugTitle={bug.title}
                        variant="ghost"
                        size="sm"
                        label="Delete"
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={totalCount}
          from={pagination.from}
          to={pagination.to}
          queryParams={{
            ...params,
            sort: params.sort,
          }}
        />
        </>
      )}
    </div>
  );
}
