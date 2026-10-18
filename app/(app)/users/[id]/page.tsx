import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { roleLabels } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import { statusClass, statusLabels } from "@/lib/labels";

type ProfileProps = { params: Promise<{ id: string }> };

/** How many of each list to show before pointing at the filtered list. */
const RECENT = 10;

const roleBadgeClass: Record<string, string> = {
  user: "bg-slate-100 text-slate-700",
  admin: "bg-teal-100 text-teal-800",
  super_admin: "bg-amber-100 text-amber-900",
};

export async function generateMetadata({
  params,
}: ProfileProps): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: user ? user.name : "Person not found",
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: ProfileProps) {
  await requireUser();
  const { id } = await params;

  const [person, reported, assigned, counts, assignedTotal] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, createdAt: true },
    }),
    prisma.bug.findMany({
      where: { reporterId: id, isDeleted: false },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: RECENT,
    }),
    prisma.bug.findMany({
      where: { assigneeId: id, isDeleted: false },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: RECENT,
    }),
    prisma.bug.groupBy({
      by: ["status"],
      where: { reporterId: id, isDeleted: false },
      _count: { _all: true },
    }),
    // Counted rather than taken from `assigned.length`, which stops at RECENT
    // and would quietly under-report anyone with more than that.
    prisma.bug.count({ where: { assigneeId: id, isDeleted: false } }),
  ]);

  if (!person) notFound();

  const reportedTotal = counts.reduce((sum, row) => sum + row._count._all, 0);
  const resolved =
    counts.find((row) => row.status === "resolved")?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/issues" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-900">
          {person.name}
          <Badge className={roleBadgeClass[person.role]}>
            {roleLabels[person.role]}
          </Badge>
        </h1>
        <p className="text-sm text-slate-600">
          Joined <LocalTime date={person.createdAt} />
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Issues reported" value={reportedTotal} />
        <Stat label="Of those, resolved" value={resolved} />
        <Stat label="Currently assigned" value={assignedTotal} />
      </dl>

      <IssueList
        heading="Reported"
        empty="Hasn't reported an issue yet."
        issues={reported}
        total={reportedTotal}
      />
      <IssueList
        heading="Assigned"
        empty="Nothing assigned right now."
        issues={assigned}
        total={assignedTotal}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </dd>
    </div>
  );
}

type ProfileIssue = {
  id: string;
  title: string;
  status: keyof typeof statusLabels;
};

function IssueList({
  heading,
  empty,
  issues,
  total,
}: {
  heading: string;
  empty: string;
  issues: ProfileIssue[];
  total?: number;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {heading}
        {total !== undefined && total > issues.length ? (
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">
            showing the {issues.length} most recent of {total}
          </span>
        ) : null}
      </h2>
      {issues.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Link
                href={`/issues/${issue.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 break-words font-medium text-slate-900">
                  {issue.title}
                </span>
                <Badge className={statusClass[issue.status]}>
                  {statusLabels[issue.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
