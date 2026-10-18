import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { LocalTime } from "@/components/local-time";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { BASE_PATH } from "@/lib/base-path";

export const metadata = { title: "Notifications" };

const PAGE_SIZE = 50;

/** In-app notification feed (#216). */
export default async function NotificationsPage() {
  const user = await requireUser();
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, title: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Notifications</h1>
          <p className="text-sm text-slate-600">
            {unread === 0 ? "You're all caught up." : `${unread} unread`}
          </p>
        </div>
        {unread > 0 ? <MarkAllReadButton /> : null}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">No notifications yet</p>
          <p className="mt-1">
            New comments, mentions, assignments and status changes on issues
            you&apos;re watching will show up here.
          </p>
          <Link href="/issues" className="mt-3 inline-flex text-sm font-medium text-teal-700 hover:underline">
            Go to issues
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {notifications.map((n) => {
            const unreadItem = !n.readAt;
            return (
              <li key={n.id}>
                {/* A plain link, not <Link>: prefetching would mark it read. */}
                <a
                  href={`${BASE_PATH}/notifications/${n.id}`}
                  className={`flex items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 ${
                    unreadItem ? "bg-teal-50/40" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unreadItem ? "bg-teal-600" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words ${unreadItem ? "font-medium text-slate-900" : "text-slate-700"}`}>
                      {unreadItem ? <span className="sr-only">Unread: </span> : null}
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      <LocalTime date={n.createdAt} />
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {notifications.length === PAGE_SIZE ? (
        <p className="text-xs text-slate-500">Showing your {PAGE_SIZE} most recent notifications.</p>
      ) : null}
    </div>
  );
}
