import type { ReactNode } from "react";

export function Badge({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border border-current px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] ${className}`}
    >
      {children}
    </span>
  );
}
