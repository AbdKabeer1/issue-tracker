import Link from "next/link";
import "./overview.css";

export type OverviewStat = {
  label: string;
  value: string;
  href: string;
  chip: string;
  chipTone: "tint" | "ok" | "bad" | "chip";
  note: string;
};

const chipClass: Record<OverviewStat["chipTone"], string> = {
  tint: "bg-zk-tint text-zk-accent",
  ok: "bg-zk-ok-bg text-zk-ok-fg",
  bad: "bg-zk-bad-bg text-zk-bad-fg",
  chip: "bg-zk-chip text-zk-text2",
};

function GoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

/**
 * Four Overview summary cards. Hover lift + top gradient use `.zk-motion`
 * so `prefers-reduced-motion` in globals turns them off.
 */
export function OverviewStatCards({ stats }: { stats: OverviewStat[] }) {
  return (
    <div
      aria-label="Workspace summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {stats.map((stat, index) => (
        <article
          key={stat.label}
          className="overview-stat-card zk-motion group relative flex flex-col gap-[18px] overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface p-[22px] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-[#BFD6FB] hover:shadow-[0_18px_40px_rgba(11,23,51,0.10),0_2px_6px_rgba(57,120,246,0.10)] motion-reduce:transform-none motion-reduce:transition-none dark:hover:border-electric-blue-strong dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(57,120,246,0.25)]"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-electric-blue to-sky-tint transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-[60px] -bottom-20 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(143,201,255,0.35),rgba(143,201,255,0)_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none dark:bg-[radial-gradient(circle,rgba(57,120,246,0.30),rgba(57,120,246,0)_70%)]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-base font-bold text-zk-text">{stat.label}</span>
            <Link
              href={stat.href}
              aria-label={`Open ${stat.label}`}
              className="zk-motion flex h-[38px] w-[38px] items-center justify-center rounded-full border border-zk-border text-zk-text transition-[background,color,border-color,transform] duration-300 group-hover:rotate-45 group-hover:border-electric-blue-strong group-hover:bg-electric-blue-strong group-hover:text-white motion-reduce:transform-none"
            >
              <GoIcon />
            </Link>
          </div>
          <p className="zk-motion relative text-[30px] font-extrabold leading-none tabular-nums text-zk-text transition-colors duration-300 group-hover:text-zk-accent">
            {stat.value}
          </p>
          <div className="relative flex items-center gap-2 text-[13px] text-zk-muted">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${chipClass[stat.chipTone]}`}
            >
              {stat.chip}
            </span>
            <span>{stat.note}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
