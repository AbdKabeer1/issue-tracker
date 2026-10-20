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
  agentName,
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
  /** Shows agent attribution e.g. "via cara_reviewer (agent)" (#578). */
  agentName?: string | null;
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
      {agentName ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600 ring-1 ring-slate-200/80"
          aria-label={`via ${agentName} (agent)`}
        >
          <span>via {agentName}</span>
          <span
            className="rounded bg-slate-200/90 px-1 text-[10px] font-medium text-slate-700"
            aria-hidden="true"
          >
            agent
          </span>
        </span>
      ) : null}
      {showAuthor ? <Badge className={authorBadgeClass}>Author</Badge> : null}
      {isAdmin(role) ? <AdminBadge /> : null}
    </span>
  );
}
