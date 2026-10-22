import { redirect } from "next/navigation";

/**
 * #423: Team moved under Settings. Legacy /team links (bookmarks, old
 * messages, docs) keep resolving by redirecting to the new location.
 */
export default function LegacyTeamPage() {
  redirect("/settings/team");
}
