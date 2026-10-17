import Link from "next/link";
import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/ui/badge";
import { authorBadgeClass } from "@/lib/labels";
import { isAdmin, type AppRole } from "@/lib/roles";

export function UserNameWithBadges({
  name,
  role,
  userId,
  showAuthor = false,
  className = "",
}: {
  name: string;
  role?: AppRole | null;
  /**
   * Links the name to that person's profile. Leave it out anywhere the name
   * already sits inside a link — a list row, say — because a link inside a
   * link is invalid and the inner one is unreachable by keyboard.
   */
  userId?: string | null;
  showAuthor?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-1.5 ${className}`}>
      {userId ? (
        <Link
          href={`/users/${userId}`}
          className="truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {name}
        </Link>
      ) : (
        <span className="truncate">{name}</span>
      )}
      {showAuthor ? <Badge className={authorBadgeClass}>Author</Badge> : null}
      {isAdmin(role) ? <AdminBadge /> : null}
    </span>
  );
}
