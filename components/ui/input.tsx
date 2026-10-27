import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-[3px] border border-zk-border bg-zk-surface px-3 py-2 text-sm text-zk-text shadow-none placeholder:text-zk-muted focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20 ${className}`}
      {...props}
    />
  );
}
