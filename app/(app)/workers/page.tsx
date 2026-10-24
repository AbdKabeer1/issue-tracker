import Link from "next/link";
import TeamPanel from "./team-panel";
import LeaderboardPanel from "./leaderboard-panel";

export const metadata = { title: "Workers" };

type WorkersSearchParams = {
  view?: string;
  online?: string;
  capacity?: string;
  area?: string;
  page?: string;
  limit?: string;
  sort?: string;
  q?: string;
};

const VIEWS = [
  { key: "team", label: "Team", href: "/workers" },
  { key: "leaderboard", label: "Leaderboard", href: "/workers?view=leaderboard" },
] as const;

/**
 * Workers: the people and agents in the workspace. The Team tab is the
 * directory (roles, capacity, agents); the Leaderboard tab ranks them by
 * points. Both used to be separate pages, /settings/team and /leaderboard.
 */
export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<WorkersSearchParams>;
}) {
  const params = await searchParams;
  const view = params.view === "leaderboard" ? "leaderboard" : "team";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Workers</h1>
        <nav aria-label="Workers view">
          <ul className="flex gap-0.5 rounded-full border border-zk-divider bg-zk-chip p-[3px]">
            {VIEWS.map(({ key, label, href }) => {
              const on = key === view;
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`inline-flex h-[34px] items-center rounded-full px-4 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue ${
                      on ? "bg-electric-blue-strong text-white" : "text-zk-text2 hover:bg-zk-surface"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      {view === "leaderboard" ? (
        <LeaderboardPanel searchParams={Promise.resolve(params)} />
      ) : (
        <TeamPanel searchParams={Promise.resolve(params)} />
      )}
    </div>
  );
}
