import Link from "next/link";

/**
 * Inbox, at the left of the Issues tab row. It works like a status tab:
 * selecting it lists the escalated issues (an agent question nobody has
 * answered yet) below, and it carries their count: red whenever any are
 * waiting, selected or not.
 */
export function InboxButton({ href, active, count }: { href: string; active: boolean; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-[42px] shrink-0 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zk-accent max-sm:h-9 ${
        active
          ? "border-electric-blue-strong bg-electric-blue-strong text-white"
          : "border-zk-divider bg-zk-chip text-zk-text hover:bg-zk-surface"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </svg>
      Inbox
      <span
        className={`min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] font-normal tabular-nums ${
          count > 0 ? "bg-zk-bad-bg text-zk-bad-fg" : active ? "bg-white/25 text-white" : "text-zk-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
