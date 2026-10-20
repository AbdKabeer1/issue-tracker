import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { generateApiKey } from "@/lib/agents/keys";
import { openSecret, sealSecret } from "@/lib/secret-box";

/** The agent created for a person in a project, so they do not register one. */
export const PERSONAL_AGENT_NAME = "Personal agent";

export type DefaultProjectKey = {
  projectId: string;
  agentId: string;
  rawKey: string;
  prefix: string;
};

/**
 * The person's copyable agent key for one project. The first visit creates a
 * contributor agent and seals the key. Later visits open the same seal.
 * A missing membership or project returns null and creates nothing.
 */
export async function ensureDefaultProjectKey(input: {
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

  const existing = await findPersonalAgent(input.userId, input.tenantId, input.projectId);
  const opened = openLiveKey(existing, input.projectId);
  if (opened) return opened;
  if (existing?.apiKeys.length) return null;
  if (existing) return issueKey(existing.id, input);

  try {
    const key = generateApiKey();
    const agent = await prisma.agent.create({
      data: {
        tenantId: input.tenantId,
        ownerUserId: input.userId,
        name: PERSONAL_AGENT_NAME,
        level: "contributor",
        defaultProjectId: input.projectId,
        apiKeys: {
          create: {
            projectId: input.projectId,
            keyHash: key.hash,
            prefix: key.prefix,
            sealedKey: sealSecret(key.raw),
          },
        },
      },
      select: { id: true },
    });
    await audit(
      { agentId: agent.id, tenantId: input.tenantId },
      "agent.created",
      `agent:${agent.id}`,
      { name: PERSONAL_AGENT_NAME, level: "contributor", projectId: input.projectId, via: "default" },
      { actorUserId: input.userId },
    );
    return { projectId: input.projectId, agentId: agent.id, rawKey: key.raw, prefix: key.prefix };
  } catch (error) {
    if (!isUnique(error)) throw error;
    const raced = await findPersonalAgent(input.userId, input.tenantId, input.projectId);
    return openLiveKey(raced, input.projectId);
  }
}

async function issueKey(
  agentId: string,
  input: { userId: string; tenantId: string; projectId: string },
): Promise<DefaultProjectKey> {
  const key = generateApiKey();
  await prisma.agentApiKey.create({
    data: {
      agentId,
      projectId: input.projectId,
      keyHash: key.hash,
      prefix: key.prefix,
      sealedKey: sealSecret(key.raw),
    },
  });
  await audit(
    { agentId, tenantId: input.tenantId },
    "agent.key_rotated",
    `agent:${agentId}`,
    { prefix: key.prefix, projectId: input.projectId, via: "default" },
    { actorUserId: input.userId },
  );
  return { projectId: input.projectId, agentId, rawKey: key.raw, prefix: key.prefix };
}

function findPersonalAgent(userId: string, tenantId: string, projectId: string) {
  return prisma.agent.findFirst({
    where: { ownerUserId: userId, tenantId, defaultProjectId: projectId, revokedAt: null },
    select: {
      id: true,
      apiKeys: {
        where: { revokedAt: null, projectId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { prefix: true, sealedKey: true },
      },
    },
  });
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

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
