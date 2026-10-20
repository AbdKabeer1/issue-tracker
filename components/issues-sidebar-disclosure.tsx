"use client";

import { IssuesSidebar, type IssuesSidebarProps } from "@/components/issues-sidebar";

/**
 * Below `lg` the full sidebar pushes the list a screen down (#574), so it
 * lives behind a closed "Views & filters" disclosure. From `lg` up the page
 * renders the plain sidebar instead.
 */
export function IssuesSidebarDisclosure(props: IssuesSidebarProps) {
  return (
    <details className="w-full lg:hidden">
      <summary className="cursor-pointer select-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs">
        Views &amp; filters
      </summary>
      <div className="mt-3">
        <IssuesSidebar {...props} />
      </div>
    </details>
  );
}
