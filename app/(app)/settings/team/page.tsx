import { redirect } from "next/navigation";
import { workersHref } from "@/app/(app)/workers/href";

/** The team directory is the Team tab of Ranking now; keep old links and filters working. */
export default async function LegacySettingsTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(workersHref("team", await searchParams));
}
