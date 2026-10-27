import type { ComponentPropsWithRef } from "react";

export function Select({
  className = "",
  children,
  ...props
}: ComponentPropsWithRef<"select">) {
  return (
    <select
      className={`w-full rounded-[3px] border border-zk-border bg-zk-surface px-3 py-2 text-sm text-zk-text shadow-none focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
