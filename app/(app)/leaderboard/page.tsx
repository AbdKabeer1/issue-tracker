import { redirect } from "next/navigation";
import { workersHref } from "@/app/(app)/workers/href";

/** The leaderboard is the Leaderboard tab of Ranking now; keep old links, paging and search working. */
export default async function LegacyLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(workersHref("leaderboard", await searchParams));
}
