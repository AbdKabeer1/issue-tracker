import { redirect } from "next/navigation";

/**
 * #423: Team moved under Settings, and now lives on Ranking (/workers). Legacy /team
 * links (bookmarks, old messages, docs) keep resolving by redirecting there.
 */
export default function LegacyTeamPage() {
  redirect("/workers");
}
