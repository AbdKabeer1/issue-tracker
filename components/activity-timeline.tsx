import type { ActivityType } from "@prisma/client";
import { LocalTime } from "@/components/local-time";

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  summary: string;
  createdAt: Date;
  actor: { name: string };
};

const typeLabel: Record<ActivityType, string> = {
  created: "Created",
  status_changed: "Status",
  severity_changed: "Severity",
  assignee_changed: "Assignee",
  commented: "Comment",
  edited: "Edit",
  boosted: "Boost",
  unboosted: "Unboost",
  deleted: "Deleted",
  restored: "Restored",
  comment_deleted: "Moderation",
  type_changed: "Type",
  category_changed: "Category",
};

export function ActivityTimeline({
  activities,
}: {
  activities: ActivityEntry[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Activity ({activities.length})
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Read-only history of changes on this issue.
      </p>
      {activities.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="relative mt-5 space-y-0 border-l border-slate-200 pl-4 sm:pl-5">
          {activities.map((entry) => (
            <li key={entry.id} className="relative pb-5 last:pb-0">
              <span
                aria-hidden
                className="absolute -left-[1.2rem] sm:-left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600"
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {typeLabel[entry.type]}
                </span>
                <LocalTime
                  className="text-xs text-slate-500"
                  date={entry.createdAt}
                />
              </div>
              <p className="mt-1 text-sm text-slate-800">
                <span className="font-medium text-slate-900">
                  {entry.actor.name}
                </span>{" "}
                {entry.summary}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
