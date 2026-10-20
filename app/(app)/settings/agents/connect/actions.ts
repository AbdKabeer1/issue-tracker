"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";

export type ConnectionStatusResult = {
  connected: boolean;
  message?: string;
  agent?: {
    id: string;
    name: string;
    model?: string | null;
    lastUsedAt?: string | null;
  };
};

/**
 * Checks if any agent owned by the user in this workspace has verified their connection (#610).
 * Specifically looks for an AgentApiKey where `lastUsedAt` is recorded.
 */
export async function checkAgentConnectionAction(params?: {
  projectId?: string | null;
  since?: string | null;
}): Promise<ConnectionStatusResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) {
    return { connected: false, message: "No active workspace found." };
  }

  const whereClause: {
    agent: {
      ownerUserId: string;
      tenantId: string;
      revokedAt: null;
    };
    lastUsedAt: { not: null; gte?: Date };
    projectId?: string;
  } = {
    agent: {
      ownerUserId: user.id,
      tenantId,
      revokedAt: null,
    },
    lastUsedAt: { not: null },
  };

  if (params?.projectId) {
    whereClause.projectId = params.projectId;
  }

  if (params?.since) {
    const sinceDate = new Date(params.since);
    if (!isNaN(sinceDate.getTime())) {
      // Allow slight 30s clock skew
      whereClause.lastUsedAt = {
        not: null,
        gte: new Date(sinceDate.getTime() - 30000),
      };
    }
  }

  const activeKey = await prisma.agentApiKey.findFirst({
    where: whereClause,
    include: {
      agent: {
        select: { id: true, name: true, model: true },
      },
    },
    orderBy: { lastUsedAt: "desc" },
  });

  if (!activeKey || !activeKey.lastUsedAt) {
    // If none matched with strict `since` filter, check fallback for this workspace
    const fallbackKey = await prisma.agentApiKey.findFirst({
      where: {
        agent: {
          ownerUserId: user.id,
          tenantId,
          revokedAt: null,
        },
        ...(params?.projectId ? { projectId: params.projectId } : {}),
        lastUsedAt: { not: null },
      },
      include: {
        agent: {
          select: { id: true, name: true, model: true },
        },
      },
      orderBy: { lastUsedAt: "desc" },
    });

    if (fallbackKey && fallbackKey.lastUsedAt) {
      return {
        connected: true,
        agent: {
          id: fallbackKey.agent.id,
          name: fallbackKey.agent.name,
          model: fallbackKey.agent.model,
          lastUsedAt: fallbackKey.lastUsedAt.toISOString(),
        },
      };
    }

    return {
      connected: false,
      message:
        "No agent call detected yet. Follow the steps above to pair your agent and call /api/v1/agents/me.",
    };
  }

  return {
    connected: true,
    agent: {
      id: activeKey.agent.id,
      name: activeKey.agent.name,
      model: activeKey.agent.model,
      lastUsedAt: activeKey.lastUsedAt.toISOString(),
    },
  };
}
