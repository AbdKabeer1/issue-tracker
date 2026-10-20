import { headers } from "next/headers";
import { ReportIssueFab } from "@/components/report-issue-fab";
import { auth } from "@/auth";
import { requireUser } from "@/lib/auth-helpers";
import { isLinkPreviewBot } from "@/lib/link-preview";
import { AppHeader } from "@/components/app-header";
import { getUnreadCount } from "@/lib/lookups";
import { REPORT_FORM_URL } from "@/lib/report-form";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { FocusMainOnNavigate } from "@/components/focus-main-on-navigate";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { isAdmin } from "@/lib/roles";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { prisma } from "@/lib/prisma";
import type { AgentKeyHint } from "@/components/agent-key-copy";
import { projectContextFor, type ProjectChoice } from "@/lib/project-context";
import { currentTenantIdFor } from "@/lib/tenant-context";

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
          <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
            {children}
          </main>
        </div>
      );
    }
  }

  const user = await requireUser();
  // #426: the header switcher and the issue list read the same active project.
  let projects: ProjectChoice[] = [];
  let activeProjectId: string | null = null;
  let canManagePlatforms = false;
  let agentKeys: AgentKeyHint[] = [];
  let tenantId: string | null = null;
  try {
    tenantId = await currentTenantIdFor(user.id);
    const context = await projectContextFor(prisma, tenantId);
    projects = context.projects;
    activeProjectId = context.activeProjectId;
    if (tenantId) {
      const membership = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        select: { role: true },
      });
      canManagePlatforms = isTenantAdminRole(membership?.role, user.role);
    }
  } catch (error) {
    console.error("[layout] project context failed", error);
  }
  // Prefixes only: the raw key is shown once and never stored (#742).
  if (tenantId && activeProjectId) {
    try {
      const keys = await prisma.agentApiKey.findMany({
        where: {
          revokedAt: null,
          agent: { ownerUserId: user.id, revokedAt: null, tenantId },
          OR: [{ projectId: activeProjectId }, { projectId: null }],
        },
        select: { prefix: true, project: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      agentKeys = keys.map((key) => ({ prefix: key.prefix, projectName: key.project?.name ?? null }));
    } catch (error) {
      console.error("[layout] agent key prefixes failed", error);
    }
  }
  // A missing Notification table must not take down every signed-in page.
  let unreadCount = 0;
  try {
    // Cached per user and expired by every write that changes it (#317), so
    // ordinary navigation doesn't pay for a count query.
    unreadCount = await getUnreadCount(user.id);
  } catch (error) {
    console.error("[layout] notification count failed", error);
  }

  // #287: one primary-key read; a failure leaves shortcuts on, the default.
  let shortcutsEnabled = true;
  try {
    const prefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: { keyboardShortcuts: true },
    });
    shortcutsEnabled = prefs?.keyboardShortcuts ?? true;
  } catch (error) {
    console.error("[layout] shortcut setting failed", error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SkipLink />
      <AppHeader
        userName={user.name ?? user.email}
        userImage={user.image}
        role={user.role}
        isRealSuperAdmin={user.isRealSuperAdmin}
        isRealAdmin={user.isRealAdmin}
        unreadCount={unreadCount}
        userId={user.id}
        projects={projects}
        activeProjectId={activeProjectId}
        canManagePlatforms={canManagePlatforms}
        agentKeys={agentKeys}
      />
      <main
        id={MAIN_CONTENT_ID}
        /* Focusable so the skip link and the route announcer can move focus
           here; -1 keeps it out of the normal tab order. */
        tabIndex={-1}
        className={`outline-none mx-auto w-full max-w-7xl flex-1 px-3.5 pt-5 sm:px-4 sm:pt-8 ${
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
      <KeyboardShortcuts
        enabled={shortcutsEnabled}
        dashboard={isAdmin(user.role)}
      />
    </div>
  );
}
