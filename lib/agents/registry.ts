import type { AgentLevel, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, type AppRole } from "@/lib/roles";
import { audit } from "@/lib/agents/audit";
import { generateApiKey } from "@/lib/agents/keys";
import { sealSecret } from "@/lib/secret-box";
import { CREATION_LEVELS, DEFAULT_AGENT_LEVEL, canSetLevel } from "@/lib/agents/levels";
import { isTenantAdmin } from "@/lib/agents/membership";
import { currentTenantIdFor } from "@/lib/tenant-context";
import type { AgentContext } from "@/lib/agents/require-agent";
import { AGENT_LIMIT_MESSAGE, AGENT_MODEL_MAX, AGENT_NAME_MAX, MAX_ACTIVE_AGENTS_PER_OWNER } from "@/lib/agents/registry-limits";
import { releaseWorkOfRevokedAgent } from "@/lib/agent-api/revoke-release";

/**
 * Registering agents and managing their keys (#427). A person creates agents
 * under their own account, sees each key once, and can revoke them; a tenant
 * admin can revoke any agent in the tenant. An agent can only rotate its own
 * key: it can't rename itself, change owner, create agents or raise its level.
 */

export { AGENT_MODEL_MAX, AGENT_NAME_MAX };

const text = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), `${label} can't contain control characters.`),
    );

export const agentNameSchema = text(AGENT_NAME_MAX, "Name").pipe(
  z.string().min(2, "Give the agent a name of at least 2 characters, like “Ada's Claude”."),
);
export const agentModelSchema = text(AGENT_MODEL_MAX, "Model");

export const createAgentSchema = z.object({
  name: agentNameSchema,
  model: agentModelSchema.optional().transform((value) => value || null),
  level: z.enum(CREATION_LEVELS).default(DEFAULT_AGENT_LEVEL),
  projectId: z.string().trim().min(1, "Choose the project this key can work in.").max(191),
});

export type Actor = { id: string; role?: AppRole | null };

type Db = PrismaClient | Prisma.TransactionClient;

export type IssuedKey = { agentId: string; name: string; rawKey: string; prefix: string };

/** Inserts an agent and its first key. Shared by the settings page and pairing. */
export async function insertAgentWithKey(
  db: Db,
  input: { tenantId: string; ownerUserId: string; name: string; model: string | null; level: AgentLevel; projectId: string },
): Promise<IssuedKey> {
  const key = generateApiKey();
  const { projectId, ...agentInput } = input;
  const agent = await db.agent.create({
    data: {
      ...agentInput,
      apiKeys: { create: { keyHash: key.hash, prefix: key.prefix, projectId } },
    },
    select: { id: true, name: true },
  });
  return { agentId: agent.id, name: agent.name, rawKey: key.raw, prefix: key.prefix };
}

export type CreateAgentResult =
  | { ok: true; key: IssuedKey }
  | { ok: false; error: string; field?: "name" | "model" | "level" | "projectId" };

/** The owner, signed in, registers an agent and gets its key once. */
export async function createAgent(owner: Actor, input: unknown): Promise<CreateAgentResult> {
  const parsed = createAgentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Check the agent's details.",
      field: field === "name" || field === "model" || field === "level" || field === "projectId" ? field : undefined,
    };
  }
  const tenantId = await currentTenantIdFor(owner.id);
  if (!tenantId) {
    return { ok: false, error: "Join or create a team before you register agents." };
  }
  const project = await projectInTenant(tenantId, parsed.data.projectId);
  if (!project) return { ok: false, error: "Choose a project in this workspace.", field: "projectId" };

  const key = await prisma.$transaction(async (tx) => {
    // Per-agent budgets would multiply with every extra agent (#511).
    const active = await tx.agent.count({
      where: { tenantId, ownerUserId: owner.id, revokedAt: null },
    });
    if (active >= MAX_ACTIVE_AGENTS_PER_OWNER) return null;
    const issued = await insertAgentWithKey(tx, {
      tenantId,
      ownerUserId: owner.id,
      name: parsed.data.name,
      model: parsed.data.model,
      level: parsed.data.level,
      projectId: project.id,
    });
    await audit(
      { agentId: issued.agentId, tenantId },
      "agent.created",
      `agent:${issued.agentId}`,
      { name: issued.name, model: parsed.data.model, level: parsed.data.level, projectId: project.id, via: "settings" },
      { actorUserId: owner.id, db: tx },
    );
    return issued;
  });
  if (!key) return { ok: false, error: AGENT_LIMIT_MESSAGE };
  return { ok: true, key };
}

type ManagedAgent = {
  id: string;
  name: string;
  tenantId: string;
  ownerUserId: string;
  revokedAt: Date | null;
  defaultProjectId: string | null;
};

async function projectInTenant(tenantId: string, projectId: string) {
  if (!projectId) return null;
  return prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true, slug: true, name: true },
  });
}

/** The agent, and whether the actor may manage it: its owner or a tenant admin. */
async function managedAgent(actor: Actor, agentId: string) {
  const agent: ManagedAgent | null = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, tenantId: true, ownerUserId: true, revokedAt: true, defaultProjectId: true },
  });
  if (!agent) return null;
  const isOwner = agent.ownerUserId === actor.id;
  const isAdmin = await isTenantAdmin(actor, agent.tenantId);
  if (!isOwner && !isAdmin) return null;
  return { agent, isOwner, isTenantAdmin: isAdmin };
}

export type ManageResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That agent doesn't exist, or it isn't yours to change.";

/**
 * Revokes the agent and every key it has. A revoked key fails
 * `requireAgent()` from the next call on. Revoking twice is harmless.
 */
export async function revokeAgent(actor: Actor, agentId: string, now = new Date()): Promise<ManageResult> {
  const managed = await managedAgent(actor, agentId);
  if (!managed) return { ok: false, error: NOT_FOUND };
  if (managed.agent.revokedAt) return { ok: true };
  await prisma.$transaction(async (tx) => {
    await tx.agent.update({ where: { id: agentId }, data: { revokedAt: now } });
    await tx.agentApiKey.updateMany({ where: { agentId, revokedAt: null }, data: { revokedAt: now } });
    // #523: a dead key can't deliver, so its claims and bids go back to the team.
    const handedBack = await releaseWorkOfRevokedAgent(tx, {
      agentId,
      tenantId: managed.agent.tenantId,
      actorUserId: actor.id,
      now,
    });
    await audit(
      { agentId, tenantId: managed.agent.tenantId },
      "agent.revoked",
      `agent:${agentId}`,
      { by: managed.isOwner ? "owner" : "tenant_admin", ...handedBack },
      { actorUserId: actor.id, db: tx },
    );
  });
  return { ok: true };
}

/** The owner, or a tenant admin, moves an agent to another level. */
export async function setAgentLevel(actor: Actor, agentId: string, level: AgentLevel): Promise<ManageResult> {
  const managed = await managedAgent(actor, agentId);
  if (!managed) return { ok: false, error: NOT_FOUND };
  if (managed.agent.revokedAt) return { ok: false, error: "That agent is revoked." };
  if (!canSetLevel(managed, level)) {
    return { ok: false, error: "Only a team admin can make an agent a merger." };
  }
  const before = await prisma.agent.findUniqueOrThrow({ where: { id: agentId }, select: { level: true } });
  if (before.level === level) return { ok: true };
  await prisma.$transaction(async (tx) => {
    await tx.agent.update({ where: { id: agentId }, data: { level } });
    await audit(
      { agentId, tenantId: managed.agent.tenantId },
      "agent.level_changed",
      `agent:${agentId}`,
      { from: before.level, to: level, by: managed.isOwner ? "owner" : "tenant_admin" },
      { actorUserId: actor.id, db: tx },
    );
  });
  return { ok: true };
}

/**
 * Turns the higher write budget on or off (#440). A workspace admin or a
 * site admin may do this. An owner who is not an admin cannot.
 */
export async function setAgentBurst(actor: Actor, agentId: string, burst: boolean): Promise<ManageResult> {
  const managed = await managedAgent(actor, agentId);
  if (!managed) return { ok: false, error: NOT_FOUND };
  if (!managed.isTenantAdmin && !isAdmin(actor.role)) {
    return { ok: false, error: "Only an admin can change an agent's write budget." };
  }
  if (managed.agent.revokedAt) return { ok: false, error: "That agent is revoked." };
  const before = await prisma.agent.findUniqueOrThrow({ where: { id: agentId }, select: { burst: true } });
  if (before.burst === burst) return { ok: true };
  await prisma.$transaction(async (tx) => {
    await tx.agent.update({ where: { id: agentId }, data: { burst } });
    await audit(
      { agentId, tenantId: managed.agent.tenantId },
      "agent.burst_changed",
      `agent:${agentId}`,
      { from: before.burst, to: burst, by: "admin" },
      { actorUserId: actor.id, db: tx },
    );
  });
  return { ok: true };
}

/**
 * The agent replaces the key it called with. Same agent, name and owner; the
 * old key stops working and the new one is shown once.
 */
export async function rotateKey(agent: AgentContext, now = new Date()): Promise<IssuedKey> {
  const key = generateApiKey();
  return prisma.$transaction(async (tx) => {
    const revoked = await tx.agentApiKey.updateMany({
      where: { id: agent.keyId, agentId: agent.agentId, revokedAt: null },
      data: { revokedAt: now },
    });
    // Two rotations racing with the same key: only the first gets a new one.
    if (revoked.count !== 1) throw new Error("This key was already rotated or revoked.");
    const personal = await tx.agent.findUnique({
      where: { id: agent.agentId },
      select: { defaultProjectId: true },
    });
    const reseal = personal?.defaultProjectId != null && personal.defaultProjectId === agent.projectId;
    await tx.agentApiKey.create({
      data: {
        agentId: agent.agentId,
        keyHash: key.hash,
        prefix: key.prefix,
        projectId: agent.projectId ?? null,
        ...(reseal ? { sealedKey: sealSecret(key.raw) } : {}),
      },
    });
    await audit(agent, "agent.key_rotated", `agent:${agent.agentId}`, { prefix: key.prefix, projectId: agent.projectId ?? null }, { db: tx });
    return { agentId: agent.agentId, name: agent.name, rawKey: key.raw, prefix: key.prefix };
  });
}

export type RegenerateKeyResult =
  | { ok: true; key: IssuedKey }
  | { ok: false; error: string; field?: "projectId" };

/**
 * The owner or a tenant admin replaces every live key without the old secret
 * (#572). The agent, its level and its history stay. The new key is shown once
 * and is limited to the project they choose.
 */
export async function regenerateKey(
  actor: Actor,
  agentId: string,
  projectId: string,
  now = new Date(),
): Promise<RegenerateKeyResult> {
  const managed = await managedAgent(actor, agentId);
  if (!managed) return { ok: false, error: NOT_FOUND };
  if (managed.agent.revokedAt) return { ok: false, error: "That agent is revoked." };
  const project = await projectInTenant(managed.agent.tenantId, projectId);
  if (!project) return { ok: false, error: "Choose a project in this workspace.", field: "projectId" };

  const key = generateApiKey();
  const reseal = managed.agent.defaultProjectId === project.id;
  await prisma.$transaction(async (tx) => {
    await tx.agentApiKey.updateMany({ where: { agentId, revokedAt: null }, data: { revokedAt: now } });
    await tx.agentApiKey.create({
      data: {
        agentId,
        keyHash: key.hash,
        prefix: key.prefix,
        projectId: project.id,
        ...(reseal ? { sealedKey: sealSecret(key.raw) } : {}),
      },
    });
    await audit(
      { agentId, tenantId: managed.agent.tenantId },
      "agent.key_rotated",
      `agent:${agentId}`,
      { prefix: key.prefix, projectId: project.id, by: managed.isOwner ? "owner" : "tenant_admin", via: "settings" },
      { actorUserId: actor.id, db: tx },
    );
  });
  return {
    ok: true,
    key: { agentId, name: managed.agent.name, rawKey: key.raw, prefix: key.prefix },
  };
}
