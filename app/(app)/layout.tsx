import { headers } from "next/headers";
import { ReportIssueFab } from "@/components/report-issue-fab";
import { auth } from "@/auth";
import { requireUser } from "@/lib/auth-helpers";
import { isLinkPreviewBot } from "@/lib/link-preview";
import { AppHeader } from "@/components/app-header";
import { REPORT_FORM_URL } from "@/lib/report-form";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { FocusMainOnNavigate } from "@/components/focus-main-on-navigate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Link-preview crawlers may reach /bugs/[id] without a session. Render a
  // minimal shell so generateMetadata + the public preview body can respond.
  if (!session?.user) {
    const ua = (await headers()).get("user-agent");
    if (isLinkPreviewBot(ua)) {
      return (
        <div className="flex min-h-screen flex-col bg-slate-50">
          <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
        </div>
      );
    }
  }

  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SkipLink />
      <AppHeader
        userName={user.name ?? user.email}
        role={user.role}
        isRealSuperAdmin={user.isRealSuperAdmin}
        isRealAdmin={user.isRealAdmin}
      />
      <main
        id={MAIN_CONTENT_ID}
        /* Focusable so the skip link and the route announcer can move focus
           here; -1 keeps it out of the normal tab order. */
        tabIndex={-1}
        className={`outline-none mx-auto w-full max-w-5xl flex-1 px-3.5 pt-5 sm:px-4 sm:pt-8 ${
          // #221: the fixed FAB sits over the bottom-right of the viewport and
          // was covering pagination "Next" and the Danger-zone Delete button.
          // Reserve clearance only when the FAB actually renders, so we don't
          // leave dead space in deployments without REPORT_FORM_URL.
          REPORT_FORM_URL ? "pb-20 sm:pb-24" : "pb-5 sm:pb-8"
        }`}
      >
        {children}
      </main>
      <ReportIssueFab href={REPORT_FORM_URL} />
      <FocusMainOnNavigate />
    </div>
  );
}
