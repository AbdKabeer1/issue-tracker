import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/auth-helpers";
import { resolveSessionUserId } from "@/lib/session-user";
import { LocalTime } from "@/components/local-time";
import { buildCommentTree } from "@/lib/comments";
import {
  bugLinkPreviewDescription,
  snippetText,
} from "@/lib/link-preview";
import { stripMarkdown } from "@/lib/rich-text";
import { absoluteUrl } from "@/lib/site-url";
import {
  severityClass,
  severityLabels,
  statusClass,
  statusLabels,
} from "@/lib/labels";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Badge } from "@/components/ui/badge";
import { VoteButton } from "@/components/vote-button";
import { UpdateBugForm } from "@/components/update-bug-form";
import { CommentThread } from "@/components/comment-thread";
import { RichText } from "@/components/rich-text";
import { MentionText } from "@/components/comment-body";
import { UserNameWithBadges } from "@/components/user-name-with-badges";
import {
  getActiveIssueTypes,
  getIssueTypeBadgeClass,
} from "@/lib/issue-types";
import { fetchVoterSummary } from "@/lib/voter-summaries";
import { canDeleteTicket } from "@/lib/ticket-deletion";
import { DeleteBugButton } from "@/components/delete-bug-button";
import { BoostTicketButton } from "@/components/boost-ticket-button";
import { SelfAssignButton } from "@/components/self-assign-button";

type BugPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: BugPageProps): Promise<Metadata> {
  const { id } = await params;
  const bug = await prisma.bug.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      status: true,
      updatedAt: true,
      reporter: { select: { name: true } },
    },
  });

  if (!bug) {
    return {
      title: "Issue not found",
      description: "This issue could not be found.",
      robots: { index: false, follow: false },
    };
  }

  const description = bugLinkPreviewDescription({
    status: bug.status,
    authorName: bug.reporter.name,
    description: stripMarkdown(bug.description),
  });
  const canonical = absoluteUrl(`/bugs/${id}`);
  // Brand mark from public/; most unfurlers accept SVG, raster copy at /Zedu.png.
  const image = absoluteUrl("/zedu-mark.svg");
  const title = bug.title;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      siteName: "Zedu Issues",
      authors: [bug.reporter.name],
      modifiedTime: bug.updatedAt.toISOString(),
      images: [{ url: image, alt: "Zedu Issues" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    other: {
      "bug:status": statusLabels[bug.status],
      "bug:author": bug.reporter.name,
    },
  };
}

export default async function BugDetailPage({ params }: BugPageProps) {
  const { id } = await params;
  const resolved = await resolveSessionUserId();
  const userId = "userId" in resolved ? resolved.userId : undefined;

  // Unauthenticated crawlers only get a safe, limited preview (no comments,
  // emails, or proof links). Interactive UI stays behind auth.
  if (!userId) {
    const bug = await prisma.bug.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        status: true,
        severity: true,
        reporter: { select: { name: true } },
      },
    });
    if (!bug) notFound();

    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10">
        <p className="text-sm text-slate-500">Zedu Issues</p>
        <h1 className="text-2xl font-semibold text-slate-900">{bug.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge className={statusClass[bug.status]}>
            {statusLabels[bug.status]}
          </Badge>
          <Badge className={severityClass[bug.severity]}>
            {severityLabels[bug.severity]}
          </Badge>
        </div>
        <p className="text-sm text-slate-600">
          Reported by {bug.reporter.name}
        </p>
        <p className="text-slate-800">{snippetText(bug.description, 280)}</p>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/bugs/${id}`)}`}
          className="inline-flex text-sm font-medium text-teal-700 hover:underline"
        >
          Sign in to view full details
        </Link>
      </div>
    );
  }

  const user = await requireUser();
  const canTriage = isAdmin(user.role);
  const canDelete = canDeleteTicket(user.role);

  const [bug, users, categories, types, voterSummary] = await Promise.all([
    prisma.bug.findUnique({
      where: { id },
      include: {
        type: true,
        reporter: { select: { name: true, email: true, role: true } },
        assignee: { select: { id: true, name: true, role: true } },
        category: { select: { id: true, name: true } },
        comments: {
          include: {
            author: { select: { name: true, role: true } },
            parent: {
              select: {
                id: true,
                body: true,
                author: { select: { name: true, role: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        activities: {
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        votes: { where: { userId }, select: { id: true, value: true }, take: 1 },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    canTriage ? getActiveIssueTypes() : Promise.resolve([]),
    fetchVoterSummary(id),
  ]);

  if (!bug) {
    notFound();
  }

  const isAssignee = !!userId && bug.assigneeId === userId;
  const canUpdateStatus = canTriage || isAssignee;
  const userVote =
    Array.isArray(bug.votes) && bug.votes.length > 0
      ? (bug.votes[0].value ?? 1)
      : 0;
  const commentTree = buildCommentTree(bug.comments);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
            ← Back to issues
          </Link>
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 break-words">
                {bug.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {bug.isBoosted ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 shadow-2xs">
                    ⚡ Boosted
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
                <Badge className={statusClass[bug.status]}>
                  {statusLabels[bug.status]}
                </Badge>
                <Badge className={severityClass[bug.severity]}>
                  {severityLabels[bug.severity]}
                </Badge>
                {bug.category ? (
                  <Badge className="border border-teal-200 bg-teal-50 text-teal-800">
                    {bug.category.name}
                  </Badge>
                ) : null}
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {bug.voteCount} score ({voterSummary.likes.count} like{voterSummary.likes.count === 1 ? "" : "s"}, {voterSummary.dislikes.count} dislike{voterSummary.dislikes.count === 1 ? "" : "s"})
                </span>
              </div>
            </div>

            {/* Reactions and larger avatars sitting under the title */}
            <div className="pt-1">
              <VoteButton
                bugId={bug.id}
                voteCount={bug.voteCount}
                userVote={userVote}
                likeCount={voterSummary.likes.count}
                dislikeCount={voterSummary.dislikes.count}
                likeVoters={voterSummary.likes.voters}
                dislikeVoters={voterSummary.dislikes.voters}
                size="md"
                showAvatars
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:pt-6">
          <SelfAssignButton
            bugId={bug.id}
            isAssignedToMe={isAssignee}
            size="sm"
          />
          {canTriage ? (
            <BoostTicketButton
              bugId={bug.id}
              isBoosted={bug.isBoosted}
              size="sm"
            />
          ) : null}
          {canDelete ? (
            <DeleteBugButton
              bugId={bug.id}
              bugTitle={bug.title}
              variant="danger-secondary"
              size="sm"
            />
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Description
        </h2>
        <RichText
          content={bug.description}
          renderMentions={(text) => <MentionText text={text} users={users} />}
        />
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
          {bug.type ? (
            <div>
              <dt className="font-medium text-slate-500">Type</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getIssueTypeBadgeClass(
                    bug.type.name,
                  )}`}
                >
                  {bug.type.name}
                </span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-slate-500">Reporter</dt>
            <dd>
              <UserNameWithBadges
                name={bug.reporter.name}
                role={bug.reporter.role}
                showAuthor
              />
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Assignee</dt>
            <dd className="flex items-center gap-2">
              {bug.assignee ? (
                <UserNameWithBadges
                  name={bug.assignee.name}
                  role={bug.assignee.role}
                />
              ) : (
                <span className="text-slate-500">Unassigned</span>
              )}
              <SelfAssignButton
                bugId={bug.id}
                isAssignedToMe={isAssignee}
                variant="ghost"
                size="xs"
              />
            </dd>
          </div>
          {bug.category ? (
            <div>
              <dt className="font-medium text-slate-500">Category</dt>
              <dd>{bug.category.name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-slate-500">Created</dt>
            <dd><LocalTime date={bug.createdAt} /></dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Updated</dt>
            <dd><LocalTime date={bug.updatedAt} /></dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Proof links
        </h2>
        {bug.proofLinks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No proof links attached to this report.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bug.proofLinks.map((url, index) => (
              <li key={`${index}-${url}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-medium text-teal-700 hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canUpdateStatus ? (
        <UpdateBugForm
          bugId={bug.id}
          status={bug.status}
          severity={bug.severity}
          typeId={bug.typeId}
          assigneeId={bug.assigneeId}
          categoryId={bug.categoryId}
          users={users}
          categories={categories}
          types={types}
          canEditTriage={canTriage}
        />
      ) : null}

      <ActivityTimeline activities={bug.activities} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Comments ({bug.comments.length})
        </h2>
        <CommentThread
          bugId={bug.id}
          reporterId={bug.reporterId}
          comments={commentTree}
          users={users}
        />
      </section>

      {canDelete ? (
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
                Danger zone
              </h2>
              <p className="text-sm text-slate-600">
                Permanently delete this ticket along with all its comments, votes, and activity history.
              </p>
            </div>
            <DeleteBugButton
              bugId={bug.id}
              bugTitle={bug.title}
              variant="danger"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
