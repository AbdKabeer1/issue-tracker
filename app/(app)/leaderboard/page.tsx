import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import {
  paginatedTenantLeaderboard,
  pointTotals,
  tenantRankFor,
  DEFAULT_LEADERBOARD_LIMIT,
  type LeaderboardEntry,
} from "@/lib/points/leaderboard";
import { getPlatformRewardConfig } from "@/lib/points/platform-rewards";
import { Avatar } from "@/components/avatar";

export const metadata = { title: "Leaderboard" };

type SortKey = "points" | "solved";

const PODIUM_MEDALS = [
  { fg: "#E0A100", bg: "rgba(224,161,0,0.16)" },
  { fg: "#94A3B8", bg: "rgba(148,163,184,0.18)" },
  { fg: "#C2703D", bg: "rgba(194,112,61,0.16)" },
] as const;

/** One shape for every leaderboard link, so the redirect and Previous/Next agree. */
function leaderboardHref(opts: {
  page: number;
  limit: number;
  sort?: SortKey;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));
  if (opts.sort && opts.sort !== "points") params.set("sort", opts.sort);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  return `/leaderboard?${params.toString()}`;
}

function progressPct(points: number, target: number): number {
  const goal = target > 0 ? target : 1;
  return Math.min(100, Math.max(0, Math.round((points / goal) * 100)));
}

function parseSort(raw: string | undefined): SortKey {
  return raw === "solved" ? "solved" : "points";
}

/** Load every ranked member when we need a full-board sort or search. */
async function loadAllEntries(
  tenantId: string,
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const first = await paginatedTenantLeaderboard(prisma, tenantId, { page: 1, limit: 100 });
  if (first.totalPages <= 1) {
    return { entries: first.entries, total: first.total };
  }
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      paginatedTenantLeaderboard(prisma, tenantId, { page: i + 2, limit: 100 }),
    ),
  );
  return {
    entries: [first.entries, ...rest.map((r) => r.entries)].flat(),
    total: first.total,
  };
}

function sortEntries(entries: LeaderboardEntry[], sort: SortKey): LeaderboardEntry[] {
  if (sort === "points") return entries;
  return [...entries].sort(
    (a, b) => b.solvedTasks - a.solvedTasks || b.points - a.points || a.name.localeCompare(b.name),
  );
}

/** Members of the current tenant ranked by points (#428, #657). */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; limit?: string; sort?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(10, parseInt(params.limit ?? String(DEFAULT_LEADERBOARD_LIMIT), 10) || DEFAULT_LEADERBOARD_LIMIT),
  );
  const sort = parseSort(params.sort);
  const q = (params.q ?? "").trim();
  const needsFullBoard = sort === "solved" || q.length > 0;

  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const targetPoints = (await getPlatformRewardConfig(prisma)).target;


  let rows: LeaderboardEntry[] = [];
  let total = 0;
  let totalPages = 0;
  let podium: LeaderboardEntry[] = [];
  let myStanding: { rank: number; total: number } | null = null;
  let myTotals = { points: 0, solvedTasks: 0 };
  let secondPlacePoints: number | null = null;

  if (tenantId) {
    const [standing, totals, top3] = await Promise.all([
      tenantRankFor(prisma, tenantId, user.id),
      pointTotals(prisma, tenantId, user.id),
      paginatedTenantLeaderboard(prisma, tenantId, { page: 1, limit: 3 }),
    ]);
    myStanding = standing;
    myTotals = totals;
    podium = top3.entries.slice(0, 3);
    secondPlacePoints = top3.entries[1]?.points ?? null;

    if (needsFullBoard) {
      const all = await loadAllEntries(tenantId);
      const filtered = q
        ? all.entries.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
        : all.entries;
      const sorted = sortEntries(filtered, sort);
      total = sorted.length;
      totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;
      rows = sorted.slice(offset, offset + limit);
    } else {
      const board = await paginatedTenantLeaderboard(prisma, tenantId, { page, limit });
      rows = board.entries;
      total = board.total;
      totalPages = board.totalPages;
    }
  }

  // A page past the end (an old link, a hand-edited URL) would otherwise show
  // "No points yet" on a leaderboard that has points. Send it to the last page.
  if (total > 0 && page > totalPages) {
    redirect(leaderboardHref({ page: totalPages, limit, sort, q }));
  }

  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);
  const emptyBoard = total === 0 && !q;
  const goalMet = myTotals.points >= targetPoints;
  const myPct = progressPct(myTotals.points, targetPoints);

  const standingDetail =
    myStanding?.rank === 1 && secondPlacePoints != null
      ? `${Math.max(0, myTotals.points - secondPlacePoints)} pts ahead of #2 · ${myTotals.solvedTasks} issues solved`
      : `${myTotals.solvedTasks} issues solved`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Leaderboard</h1>
          <p className="text-sm leading-relaxed text-zk-muted">
            Points for solving, reporting and reviewing issues. The goal is {targetPoints} points.
          </p>
        </div>
        <Link
          href="/points/disputes"
          className="inline-flex h-[42px] items-center gap-2 rounded-full border border-zk-border bg-zk-surface px-[18px] text-sm font-bold text-zk-text transition-colors hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m16 16 3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1zM2 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </svg>
          Disputes
        </Link>
      </div>

      {emptyBoard ? (
        <p className="rounded-[20px] border border-zk-border bg-zk-surface p-6 text-sm text-zk-text2">
          No points yet. Resolve an assigned issue to earn the first ones.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-stretch gap-4">
            <div className="grid min-w-0 flex-[999_1_640px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              {podium.map((entry, i) => {
                const medal = PODIUM_MEDALS[i] ?? PODIUM_MEDALS[2];
                const pct = progressPct(entry.points, targetPoints);
                const met = entry.points >= targetPoints;
                return (
                  <div
                    key={entry.userId}
                    className="zk-motion group relative flex flex-col gap-4 overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface p-5 motion-safe:animate-[leaderboard-in_0.5s_cubic-bezier(0.2,0.7,0.2,1)_both] motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-250 hover:border-[#BFD6FB] hover:shadow-[0_18px_40px_rgba(11,23,51,0.10),0_2px_6px_rgba(57,120,246,0.10)] motion-safe:hover:-translate-y-1 dark:hover:border-electric-blue-strong dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(57,120,246,0.25)]"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-electric-blue to-sky-tint motion-safe:transition-transform motion-safe:duration-350 group-hover:scale-x-100"
                    />
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: medal.bg, color: medal.fg }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                      </span>
                      <span className="text-[13px] font-extrabold text-zk-muted">#{entry.rank}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex rounded-full"
                        style={{ boxShadow: `0 0 0 3px var(--zk-surface), 0 0 0 5px ${medal.fg}` }}
                      >
                        <Avatar name={entry.name} image={entry.image} size="lg" className="!h-12 !w-12 text-base font-extrabold" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/users/${entry.userId}`}
                          className="truncate text-base font-bold text-zk-text hover:underline"
                        >
                          {entry.name}
                          {entry.userId === user.id ? (
                            <span className="ml-1 text-sm font-normal text-zk-muted">(you)</span>
                          ) : null}
                        </Link>
                        <span className="text-[13px] text-zk-muted">{entry.solvedTasks} solved</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[32px] font-extrabold leading-none text-zk-text motion-safe:transition-colors group-hover:text-zk-accent">
                        {entry.points}
                      </span>
                      <span className="text-sm font-semibold text-zk-muted">pts</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-zk-tint">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: met ? "#2E6FEF" : "#8FC9FF",
                          }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${met ? "text-zk-ok-fg" : "text-zk-muted"}`}>
                        {met
                          ? `Goal reached · +${entry.points - targetPoints}`
                          : `${targetPoints - entry.points} pts to goal`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative flex min-w-0 flex-[1_1_300px] flex-col gap-4 overflow-hidden rounded-[20px] bg-deep-ocean p-[22px] text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-[90px] -top-[90px] h-60 w-60 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(57,120,246,0.45), rgba(57,120,246,0) 70%)",
                }}
              />
              <span className="relative text-xs font-bold uppercase tracking-[0.08em] text-[#A9BCDF]">
                Your standing
              </span>
              <div className="relative flex items-baseline gap-2.5">
                <span className="text-[44px] font-extrabold leading-none">
                  {myStanding ? `#${myStanding.rank}` : "—"}
                </span>
                <span className="text-sm text-[#C9D6EF]">
                  of {myStanding?.total ?? total}{" "}
                  {(myStanding?.total ?? total) === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="relative flex flex-col gap-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#C9D6EF]">
                    {myTotals.points} / {targetPoints} pts
                  </span>
                  {goalMet ? (
                    <span className="rounded-full bg-[#0F3326] px-2 py-px font-bold text-[#6EE7A8]">
                      Goal reached · +{myTotals.points - targetPoints}
                    </span>
                  ) : (
                    <span className="rounded-full bg-blue-slate px-2 py-px font-bold text-[#C9D6EF]">
                      {targetPoints - myTotals.points} to goal
                    </span>
                  )}
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-blue-slate">
                  <div className="h-full rounded-full bg-electric-blue" style={{ width: `${myPct}%` }} />
                </div>
              </div>
              <span className="relative text-[13px] text-[#C9D6EF]">{standingDetail}</span>
            </div>
          </div>

          <section
            aria-label="Rankings"
            className="flex flex-col gap-3.5 rounded-[20px] border border-zk-border bg-zk-surface p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-lg font-bold text-zk-text">Rankings</h2>
                <span className="text-[13px] text-zk-muted">
                  {q ? `${total} match${total === 1 ? "" : "es"}` : `${total} people`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <form
                  action="/leaderboard"
                  method="get"
                  className="flex h-10 w-60 max-w-full items-center gap-2 rounded-full border border-zk-border bg-zk-surface px-3.5"
                >
                  <input type="hidden" name="limit" value={limit} />
                  {sort !== "points" ? <input type="hidden" name="sort" value={sort} /> : null}
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="shrink-0 text-zk-muted"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <label className="sr-only" htmlFor="leaderboard-search">
                    Search people
                  </label>
                  <input
                    id="leaderboard-search"
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder="Search people"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zk-text outline-none placeholder:text-zk-muted"
                  />
                </form>
                <div role="tablist" aria-label="Sort by" className="flex gap-0.5 rounded-full bg-zk-seg p-1">
                  {(
                    [
                      ["points", "Points"],
                      ["solved", "Solved"],
                    ] as const
                  ).map(([key, label]) => {
                    const on = sort === key;
                    return (
                      <Link
                        key={key}
                        href={leaderboardHref({ page: 1, limit, sort: key, q })}
                        role="tab"
                        aria-selected={on}
                        className={`inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue ${
                          on
                            ? "bg-zk-surface font-bold text-zk-text shadow-[0_1px_3px_rgba(21,18,31,0.12)]"
                            : "font-medium text-zk-text2 hover:text-zk-text"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="px-1 py-6 text-sm text-zk-muted">No people match that search.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="flex items-center gap-4 rounded-full bg-zk-tint px-4 py-3.5 text-xs font-bold uppercase tracking-[0.05em] text-zk-accent">
                    <span className="w-10">#</span>
                    <span className="min-w-0 flex-1">Person</span>
                    <span className="w-[260px]">Progress to {targetPoints}</span>
                    <span className="w-[90px] text-right">Solved</span>
                    <span className="w-[100px] text-right">Points</span>
                  </div>
                  <ul>
                    {rows.map((row, i) => {
                      const pct = progressPct(row.points, targetPoints);
                      const met = row.points >= targetPoints;
                      const isYou = row.userId === user.id;
                      const top = row.rank <= 3;
                      const medal = top ? PODIUM_MEDALS[row.rank - 1]?.fg : undefined;
                      return (
                        <li
                          key={row.userId}
                          className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${
                            i < rows.length - 1 ? "border-b border-zk-divider" : ""
                          } ${isYou ? "bg-[#F3F8FF] shadow-[inset_3px_0_0_#2E6FEF] dark:bg-[#13254A]" : ""}`}
                        >
                          <span className="w-10 text-sm font-extrabold" style={{ color: medal ?? undefined }}>
                            <span className={medal ? "" : "text-zk-muted"}>{row.rank}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            <Avatar
                              name={row.name}
                              image={row.image}
                              size="md"
                              className="!h-9 !w-9 text-[13px] font-extrabold"
                            />
                            <Link
                              href={`/users/${row.userId}`}
                              className="truncate text-[15px] font-semibold text-zk-text hover:underline"
                            >
                              {row.name}
                            </Link>
                            {isYou ? (
                              <span className="rounded-full bg-electric-blue-strong px-2 py-0.5 text-[11px] font-extrabold text-white">
                                You
                              </span>
                            ) : null}
                          </span>
                          <span className="flex w-[260px] items-center gap-2.5">
                            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zk-tint">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: met ? "#2E6FEF" : "#8FC9FF",
                                }}
                              />
                            </span>
                            <span className="w-10 text-right text-xs font-bold text-zk-text2">{pct}%</span>
                          </span>
                          <span className="w-[90px] text-right text-sm text-zk-text2">{row.solvedTasks}</span>
                          <span className="w-[100px] text-right text-[15px] font-extrabold text-zk-text">
                            {row.points} <span className="text-xs font-semibold text-zk-muted">pts</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-zk-text2">
                <div>
                  Showing {startIdx}–{endIdx} of {total}
                </div>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={leaderboardHref({ page: page - 1, limit, sort, q })}
                      className="rounded-full border border-zk-border bg-zk-surface px-3.5 py-1.5 text-sm font-medium text-zk-text hover:bg-zk-chip"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-full border border-zk-border bg-zk-chip px-3.5 py-1.5 text-sm font-medium text-zk-muted"
                    >
                      Previous
                    </span>
                  )}
                  <span className="text-sm text-zk-text2">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={leaderboardHref({ page: page + 1, limit, sort, q })}
                      className="rounded-full border border-zk-border bg-zk-surface px-3.5 py-1.5 text-sm font-medium text-zk-text hover:bg-zk-chip"
                    >
                      Next
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-full border border-zk-border bg-zk-chip px-3.5 py-1.5 text-sm font-medium text-zk-muted"
                    >
                      Next
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        @keyframes leaderboard-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .zk-motion, .zk-motion * {
            animation: none !important;
            transition: none !important;
          }
          .zk-motion:hover {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
