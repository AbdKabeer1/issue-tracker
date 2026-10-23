"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher, type WorkspaceChoice } from "@/components/workspace-switcher";
import { BASE_PATH } from "@/lib/base-path";
import { isNavItemActive } from "@/lib/header-nav";

const COLLAPSE_KEY = "ziki.sidebar.collapsed";
const COLLAPSE_EVENT = "ziki-sidebar-collapse";

function collapsedNow() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onStoreChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onStoreChange);
  return () => window.removeEventListener(COLLAPSE_EVENT, onStoreChange);
}

function asset(file: string) {
  return BASE_PATH ? `${BASE_PATH}/brand/${file}` : `/brand/${file}`;
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export function AppSidebar({
  issueCount,
  workspaces,
  activeTenantId,
}: {
  issueCount: number;
  workspaces: WorkspaceChoice[];
  activeTenantId: string | null;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, collapsedNow, () => false);

  const toggle = () => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsedNow() ? "0" : "1");
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  const overview = isNavItemActive(pathname, "/dashboard");
  const issues = isNavItemActive(pathname, "/issues");
  const team = isNavItemActive(pathname, "/settings/team");
  const label = collapsed ? "lg:sr-only" : "";

  return (
    <aside
      className={`flex w-full flex-col gap-4 bg-deep-ocean px-4 py-5 text-[#DCE5F5] lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:overflow-y-auto ${
        collapsed ? "lg:w-[72px] lg:px-3" : "lg:w-[248px]"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "lg:justify-center" : "justify-between"} px-1`}>
        <Link href="/dashboard" aria-label="Ziki" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint">
          <Image
            src={asset("ziki-logo-dark.png")}
            alt=""
            width={110}
            height={36}
            className={`h-9 w-[110px] object-contain ${collapsed ? "lg:hidden" : ""}`}
            unoptimized
            priority
          />
          {collapsed ? (
            <Image
              src={asset("ziki-mark.png")}
              alt=""
              width={28}
              height={28}
              className="hidden h-7 w-7 lg:block"
              unoptimized
            />
          ) : null}
        </Link>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggle}
          className="hidden h-[30px] w-[30px] items-center justify-center rounded-full border border-[#34507F] text-[#C9D6EF] lg:inline-flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
          </svg>
        </button>
      </div>

      <WorkspaceSwitcher workspaces={workspaces} activeTenantId={activeTenantId} tone="sidebar" />

      <nav aria-label="Workspace" className="flex flex-col gap-1.5">
        <SidebarLink href="/dashboard" active={overview} labelClass={label} label="Overview">
          <NavIcon>
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </NavIcon>
        </SidebarLink>
        <div className="mx-3 my-1.5 h-px bg-[#1E2E52]" />
        <SidebarLink href="/issues" active={issues} labelClass={label} label="Issues" count={issueCount}>
          <NavIcon>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </NavIcon>
        </SidebarLink>
        <SidebarLink href="/settings/team" active={team} labelClass={label} label="Team">
          <NavIcon>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
            <path d="M16 3.1a4 4 0 0 1 0 7.8" />
          </NavIcon>
        </SidebarLink>
      </nav>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  label,
  labelClass,
  count,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  labelClass: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[14px] px-4 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-tint ${
        active
          ? "bg-electric-blue-strong font-semibold text-white shadow-[0_8px_22px_rgba(46,111,239,0.45)]"
          : "font-medium text-[#DCE5F5] hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
      <span className={`min-w-0 flex-1 truncate ${labelClass}`}>{label}</span>
      {typeof count === "number" ? (
        <span className={`rounded-full bg-white/20 px-2 text-xs font-semibold tabular-nums ${labelClass}`}>
          {count > 999 ? "999+" : count}
        </span>
      ) : null}
    </Link>
  );
}
