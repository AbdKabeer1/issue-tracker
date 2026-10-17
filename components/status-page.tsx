import type { ReactNode } from "react";

/**
 * Shared layout for the error, not-found and session pages (#214): a short
 * explanation and the actions that get the person moving again.
 */
export function StatusPage({
  code,
  title,
  children,
  actions,
}: {
  code?: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-16 sm:py-24">
      {code ? (
        <p className="text-sm font-semibold text-teal-700" aria-hidden="true">
          {code}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <div className="space-y-2 text-sm leading-6 text-slate-600">{children}</div>
      <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div>
    </div>
  );
}

export const primaryActionClass =
  "inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";

export const secondaryActionClass =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";
