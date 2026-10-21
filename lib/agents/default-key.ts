import { prisma } from "@/lib/prisma";
import { openSecret } from "@/lib/secret-box";

/** The name previously given to agents auto-created on sign-in (see #442). */
export const PERSONAL_AGENT_NAME = "Personal agent";

export type DefaultProjectKey = {
  projectId: string;
  agentId: string;
  rawKey: string;
  prefix: string;
};

/**
 * The person's existing agent key for one project, opened for the header's
 * copy control. Since #442, signing in never creates an agent: people pair
 * (or register) their own agent on the Agents settings page, and this read
 * only surfaces a key when that agent already exists.
 * A missing membership or project — or a missing agent — returns null.
 */
export async function findDefaultProjectKey(input: {
  userId: string;
  tenantId: string;
  projectId: string;
}): Promise<DefaultProjectKey | null> {
  const member = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
    select: { userId: true },
  });
  if (!member) return null;
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!project) return null;
  return openLiveKey(
    await prisma.agent.findFirst({
      where: {
        ownerUserId: input.userId,
        tenantId: input.tenantId,
        defaultProjectId: input.projectId,
        revokedAt: null,
      },
      select: {
        id: true,
        apiKeys: {
          where: { revokedAt: null, projectId: input.projectId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { prefix: true, sealedKey: true },
        },
      },
    }),
    input.projectId,
  );
}

function openLiveKey(
  agent: { id: string; apiKeys: { prefix: string; sealedKey: string | null }[] } | null,
  projectId: string,
): DefaultProjectKey | null {
  const key = agent?.apiKeys[0];
  if (!agent || !key?.sealedKey) return null;
  try {
    return { projectId, agentId: agent.id, rawKey: openSecret(key.sealedKey), prefix: key.prefix };
  } catch {
    return null;
  }
}
