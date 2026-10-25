import RankingPanel, { type RankingSearchParams } from "./ranking-panel";

export const metadata = { title: "Ranking" };

/**
 * Ranking: the leaderboard's podium and your standing, then the whole team
 * with points, roles, capacity and agents. It replaces the old Team and
 * Leaderboard tabs (and before them /settings/team and /leaderboard).
 */
export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<RankingSearchParams & { view?: string }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Ranking</h1>
      <RankingPanel searchParams={searchParams} />
    </div>
  );
}
