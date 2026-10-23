import Link from "next/link";
import type { ReactNode } from "react";

export type PlatformTab = {
  /** A category id, `"resolved"` / `"none"`, or `null` for All. */
  id: string | null;
  name: string;
  count: number;
  href?: string;
  active?: boolean;
  icon?: ReactNode;
};

/**
 * #1055: platform tabs above the list. Links keep the URL; styled as a
 * segmented pill track to match the redesign handoff.
 */
export function PlatformTabs({
  tabs,
  current,
  hrefFor,
}: {
  tabs: PlatformTab[];
  current?: string | null;
  hrefFor?: (id: string | null) => string;
}) {
  if (tabs.length <= 1) return null;
  return (
    <nav
      aria-label="Platforms"
      className="min-w-0 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="inline-flex min-w-max items-center gap-0.5 rounded-full bg-zk-seg p-1">
        {tabs.map((tab) => {
          const active = tab.active ?? (tab.id === current);
          const href = tab.href ?? (hrefFor ? hrefFor(tab.id) : "#");
          return (
            <li key={tab.id ?? "all"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue ${
                  active
                    ? "bg-zk-surface font-bold text-zk-text shadow-[0_1px_3px_rgba(21,18,31,0.12)]"
                    : "font-medium text-zk-text2 hover:text-zk-text"
                }`}
              >
                {tab.icon}
                {tab.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                    active ? "bg-zk-tint text-zk-accent" : "bg-zk-chip text-zk-text2"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
