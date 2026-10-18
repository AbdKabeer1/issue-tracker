import Link from "next/link";
import { AdminBadge } from "@/components/admin-badge";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import type { AvatarSize } from "@/lib/avatar";
import { authorBadgeClass } from "@/lib/labels";
import { isAdmin, type AppRole } from "@/lib/roles";

export function UserNameWithBadges({
  name,
  role,
  userId,
  showAuthor = false,
  avatar,
  image,
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
  /** Draw the person's avatar before the name, at this size (#290). */
  avatar?: AvatarSize;
  image?: string | null;
  className?: string;
}) {
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-1.5 ${className}`}>
      {avatar ? <Avatar name={name} image={image} size={avatar} /> : null}
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
