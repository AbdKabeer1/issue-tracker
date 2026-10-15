import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/ui/badge";
import { authorBadgeClass } from "@/lib/labels";
import { isAdmin, type AppRole } from "@/lib/roles";

export function UserNameWithBadges({
  name,
  role,
  showAuthor = false,
  className = "",
}: {
  name: string;
  role?: AppRole | null;
  showAuthor?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-1.5 ${className}`}>
      <span className="truncate">{name}</span>
      {showAuthor ? <Badge className={authorBadgeClass}>Author</Badge> : null}
      {isAdmin(role) ? <AdminBadge /> : null}
    </span>
  );
}
