import type { ComponentPropsWithRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-secondary";

const variants: Record<Variant, string> = {
  primary:
    "border border-teal-800 bg-teal-700 text-white shadow-[2px_2px_0_var(--zk-text)] hover:-translate-x-px hover:-translate-y-px hover:bg-teal-800 hover:shadow-[3px_3px_0_var(--zk-text)] focus-visible:ring-teal-600 active:translate-x-px active:translate-y-px active:shadow-none",
  secondary:
    "border border-zk-border bg-zk-surface text-zk-text hover:bg-zk-chip focus-visible:ring-zk-accent",
  ghost: "bg-transparent text-zk-text2 hover:bg-zk-chip",
  danger:
    "border border-red-800 bg-red-700 text-white shadow-[2px_2px_0_var(--zk-text)] hover:-translate-x-px hover:-translate-y-px hover:bg-red-800 hover:shadow-[3px_3px_0_var(--zk-text)] focus-visible:ring-red-600 active:translate-x-px active:translate-y-px active:shadow-none",
  "danger-secondary":
    "border border-red-700 bg-zk-surface text-red-700 hover:bg-red-50 focus-visible:ring-red-600",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ComponentPropsWithRef<"button"> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      className={`zk-motion inline-flex items-center justify-center rounded-[3px] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-[transform,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
