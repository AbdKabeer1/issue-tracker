import Link from "next/link";
import { Avatar } from "@/components/avatar";

/**
 * The Overview sidebar. Chrome is navy in both themes, matching the
 * reference exports ("Preserved Deep Blue"), and every badge is a live
 * workspace-wide count whose destination shows the same set:
 * dashboard links use the additive `?project=all` view.
 */
export type DashboardSidebarCounts = {
  unresolved: number;
  assigned: number;
  reported: number;
};

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const ICONS = {
  overview:
    "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  issues:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  escalations:
    "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  assigned:
    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  reported:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  leaderboard:
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
} as const;

function CountPill({ value }: { value: number }) {
  return (
    <span className="rounded-full border border-surface-border bg-[#17274a] px-2 py-0.5 font-mono text-xs text-sky-tint">
      {value > 999 ? "999+" : value}
    </span>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  count,
  active = false,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  count?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint focus-visible:ring-offset-2 focus-visible:ring-offset-deep-ocean ${
        active
          ? "bg-electric-blue text-white shadow-sm"
          : "text-slate-300 hover:bg-white/5 hover:text-porcelain"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <NavIcon path={ICONS[icon]} />
        <span className="truncate">{label}</span>
      </span>
      {typeof count === "number" ? <CountPill value={count} /> : null}
    </Link>
  );
}

export function DashboardSidebar({
  counts,
  userName,
  userImage,
  userEmail,
}: {
  counts: DashboardSidebarCounts;
  userName?: string | null;
  userImage?: string | null;
  userEmail?: string | null;
}) {
  return (
    <aside
      aria-label="Dashboard"
      className="hidden w-60 shrink-0 flex-col justify-between rounded-xl border border-surface-border bg-sidebar-navy p-4 text-porcelain lg:flex"
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-sky-tint/70">
            Navigation
          </p>
          <nav className="space-y-1">
            <SidebarLink href="/dashboard" label="Overview" icon="overview" active />
            <SidebarLink
              href="/issues?project=all"
              label="Issues"
              icon="issues"
              count={counts.unresolved}
            />
            <SidebarLink href="/escalations" label="Escalations" icon="escalations" />
          </nav>
        </div>

        <div className="border-t border-surface-border/60 pt-3">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-sky-tint/70">
            My work
          </p>
          <nav className="space-y-1">
            <SidebarLink
              href="/issues?project=all&mine=assigned"
              label="Assigned to you"
              icon="assigned"
              count={counts.assigned}
            />
            <SidebarLink
              href="/issues?project=all&mine=reported"
              label="Reported by you"
              icon="reported"
              count={counts.reported}
            />
          </nav>
        </div>

        <div className="border-t border-surface-border/60 pt-3">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-sky-tint/70">
            Rewards
          </p>
          <nav className="space-y-1">
            <SidebarLink href="/leaderboard" label="Leaderboard" icon="leaderboard" />
          </nav>
        </div>
      </div>

      <Link
        href="/settings"
        className="mt-6 flex items-center gap-3 rounded-xl border border-surface-border bg-[#112042] p-3 transition hover:border-sky-tint/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint focus-visible:ring-offset-2 focus-visible:ring-offset-deep-ocean"
      >
        <Avatar name={userName} image={userImage} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-porcelain">
            {userName}
          </span>
          <span className="block truncate text-[11px] text-sky-tint">{userEmail}</span>
        </span>
      </Link>
    </aside>
  );
}
