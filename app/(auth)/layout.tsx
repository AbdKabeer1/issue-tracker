import type { ReactNode } from "react";
import { ReportIssueFab } from "@/components/report-issue-fab";
import { REPORT_FORM_URL } from "@/lib/report-form";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* #221: reserve clearance for the fixed FAB so it cannot sit on top of
          the primary action (e.g. "Continue with Google") on short viewports.
          Applied only when the FAB actually renders. */}
      <div className={REPORT_FORM_URL ? "pb-20 sm:pb-24" : undefined}>
        {children}
      </div>
      <ReportIssueFab href={REPORT_FORM_URL} />
    </>
  );
}