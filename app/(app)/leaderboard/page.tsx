import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { tenantLeaderboard } from "@/lib/points/leaderboard";
import { TARGET_POINTS, TARGET_SOLVED_TASKS } from "@/lib/points/rules";
import { Avatar } from "@/components/avatar";

export const metadata = { title: "Leaderboard" };

/** Members of the current tenant ranked by points (#428). */
export default async function LeaderboardPage() {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const rows = tenantId ? await tenantLeaderboard(prisma, tenantId) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leaderboard</h1>
        <p className="text-sm text-slate-600">
          Points for solving, reporting and reviewing issues. The goal is {TARGET_POINTS} points and{" "}
          {TARGET_SOLVED_TASKS} solved tasks.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No points yet. Resolve an assigned issue to earn the first ones.
        </p>
      ) : (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <li
              key={row.userId}
              className={`flex items-center gap-3 px-4 py-3 ${row.userId === user.id ? "bg-teal-50" : ""}`}
            >
              <span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-500">
                {row.rank}
              </span>
              <Avatar name={row.name} image={row.image} />
              <Link href={`/users/${row.userId}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline">
                {row.name}
                {row.userId === user.id ? <span className="ml-1 text-sm font-normal text-slate-500">(you)</span> : null}
              </Link>
              <span className="text-sm tabular-nums text-slate-600">
                {row.solvedTasks} solved
              </span>
              <span className="w-20 text-right font-semibold tabular-nums text-slate-900">
                {row.points} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
