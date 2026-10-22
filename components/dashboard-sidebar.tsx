import Link from "next/link";
import { Avatar } from "@/components/avatar";

/**
 * The persistent workspace sidebar. Chrome is navy in both themes, matching
 * the reference exports ("Preserved Deep Blue"), and every badge is a live
 * workspace-wide count whose destination shows the same set: the links use
 * the additive `?project=all` view.
 */
export type DashboardSidebarCounts = {
  unresolved: number;
  assigned: number;
  reported: number;
};

/** Which primary destination is the current page. */
export type DashboardSidebarActive = "overview" | "issues";

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
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
  assigned:
    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  reported:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
} as const;

function CountPill({ value }: { value: number }) {
  return (
    <span className="min-w-6 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-center text-xs font-medium tabular-nums leading-4 text-slate-200">
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
      className={`flex h-10 items-center justify-between gap-2 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint focus-visible:ring-offset-2 focus-visible:ring-offset-deep-ocean ${
        active
          ? "bg-electric-blue-strong font-semibold text-white shadow-[0_6px_18px_rgba(57,120,246,0.35)]"
          : "font-medium text-slate-200 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <NavIcon path={ICONS[icon]} />
        <span className="truncate">{label}</span>
      </span>
      {typeof count === "number" ? (
        <CountPill value={count} />
      ) : active ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-card" />
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({
  counts,
  active = "overview",
  userName,
  userImage,
  userEmail,
}: {
  counts: DashboardSidebarCounts;
  active?: DashboardSidebarActive;
  userName?: string | null;
  userImage?: string | null;
  userEmail?: string | null;
}) {
  return (
    <aside
      aria-label="Workspace"
      className="hidden w-60 shrink-0 flex-col justify-between rounded-xl border border-white/5 bg-deep-ocean p-4 text-porcelain lg:sticky lg:top-24 lg:flex lg:h-[calc(100dvh-7rem)]"
    >
      <div>
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Navigation
          </p>
          <nav className="space-y-1">
            <SidebarLink
              href="/dashboard"
              label="Overview"
              icon="overview"
              active={active === "overview"}
            />
            <SidebarLink
              href="/issues?project=all"
              label="Issues"
              icon="issues"
              count={counts.unresolved}
              active={active === "issues"}
            />
          </nav>
        </div>

        <div className="mt-3 border-t border-white/10 pt-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
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
      </div>

      <Link
        href="/settings"
        className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-[#132347] p-3 transition hover:border-sky-tint/30 hover:bg-[#172a52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint focus-visible:ring-offset-2 focus-visible:ring-offset-deep-ocean"
      >
        <span className="relative inline-flex">
          <Avatar name={userName} image={userImage} size="lg" variant="solid" />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#132347] bg-emerald-400"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">
            {userName}
          </span>
          <span className="block truncate text-xs text-slate-400">{userEmail}</span>
        </span>
      </Link>
    </aside>
  );
}
