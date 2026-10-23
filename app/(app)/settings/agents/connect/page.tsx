import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { projectContextFor } from "@/lib/project-context";
import { getSiteUrl } from "@/lib/site-url";
import { isAgentPlatformEnabled } from "@/lib/feature-flags";
import { getAgentTemplates } from "@/lib/agents/templates";
import { ConnectAgentView } from "./connect-agent-view";
import { agentsLink, agentsMutedClass, agentsPrimaryBtn, agentsSurface } from "../agents-ui";

export const metadata = { title: "Connect your agent" };

/**
 * Connect your agent onboarding page (#610).
 * Ready-to-paste setups for Claude, ChatGPT, and Node/Python pollers.
 */
export default async function ConnectAgentPage() {
  const user = await requireUser();

  if (!isAgentPlatformEnabled()) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-zk-text">Connect your agent</h1>
          <p className={agentsMutedClass}>The agent platform feature is not enabled in this environment.</p>
        </div>
      </div>
    );
  }

  const tenantId = await currentTenantIdFor(user.id);
  const context = await projectContextFor(prisma, tenantId);

  const activeProject =
    context.projects.find((p) => p.id === context.activeProjectId) ?? context.projects[0] ?? null;

  const projectId = activeProject?.id ?? null;
  const projectName = activeProject?.name ?? null;
  const siteUrl = getSiteUrl();

  const templates = getAgentTemplates({
    origin: siteUrl,
    projectId,
    projectName,
  });

  const initialKey = tenantId
    ? await prisma.agentApiKey.findFirst({
        where: {
          agent: { ownerUserId: user.id, tenantId, revokedAt: null },
          ...(projectId ? { projectId } : {}),
          lastUsedAt: { not: null },
        },
        include: { agent: { select: { name: true } } },
        orderBy: { lastUsedAt: "desc" },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link href="/settings/agents" className={`text-sm ${agentsLink}`}>
          ← Back to agents
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-zk-text">Connect your agent</h1>
            <p className="text-sm text-zk-text2">
              Connect a separate agent for each level you use. Pick your assistant, copy the setup block, approve the
              pairing request and test your connection.
            </p>
          </div>
          <Link href="/settings/agents/pair" className={`shrink-0 text-sm ${agentsLink}`}>
            Approve a pairing code →
          </Link>
        </div>
      </div>

      {!tenantId ? (
        <div className={`${agentsSurface} border-dashed p-6 text-sm text-zk-text2`}>
          <p>You are not currently in a workspace. Join or create a workspace before you can connect an agent.</p>
          <div className="mt-3">
            <Link href="/tenants" className={agentsPrimaryBtn}>
              Workspaces →
            </Link>
          </div>
        </div>
      ) : (
        <ConnectAgentView
          templates={templates}
          siteUrl={siteUrl}
          projectId={projectId}
          projectName={projectName}
          initialConnected={Boolean(initialKey?.lastUsedAt)}
          initialAgentName={initialKey?.agent?.name ?? null}
        />
      )}
    </div>
  );
}
