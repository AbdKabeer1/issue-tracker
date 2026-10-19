import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { generateDeviceCode, generateUserCode, hashSecret, normalizeUserCode } from "@/lib/agents/keys";
import { DEFAULT_AGENT_LEVEL } from "@/lib/agents/levels";
import { tenantForOwner } from "@/lib/agents/membership";
import { agentModelSchema, agentNameSchema, insertAgentWithKey, type Actor, type IssuedKey } from "@/lib/agents/registry";

/**
 * Pairing an agent with its owner (#427), like a TV signing in to an account:
 *
 * 1. The agent starts pairing with its name. It gets a short user code to
 *    show its owner and a secret device code to poll with.
 * 2. The owner signs in, enters the user code, sees the name and approves.
 *    That sets the owner and the tenant; nobody else can approve it after.
 * 3. The agent polls with the device code. The first poll after approval
 *    creates the agent and its key and returns the key, once.
 *
 * The key is made at step 3, not 2, so no raw key ever waits in the database.
 * Codes are stored as hashes, last 15 minutes and work once.
 */
export const PAIRING_TTL_MS = 15 * 60 * 1000;
/** How often the agent should poll, in seconds. */
export const PAIRING_POLL_INTERVAL = 5;

export type StartPairingResult =
  | { ok: true; userCode: string; deviceCode: string; expiresAt: Date }
  | { ok: false; error: string };

export async function startPairing(input: { name?: unknown; model?: unknown }, now = new Date()): Promise<StartPairingResult> {
  const name = agentNameSchema.safeParse(input.name ?? "");
  if (!name.success) return { ok: false, error: name.error.issues[0]?.message ?? "Send the agent's name." };
  const model = input.model == null ? null : agentModelSchema.safeParse(input.model);
  if (model && !model.success) return { ok: false, error: model.error.issues[0]?.message ?? "Invalid model." };

  const userCode = generateUserCode();
  const deviceCode = generateDeviceCode();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  await prisma.agentPairing.create({
    data: {
      codeHash: hashSecret(normalizeUserCode(userCode)!),
      deviceCodeHash: hashSecret(deviceCode),
      proposedName: name.data,
      proposedModel: model?.data || null,
      expiresAt,
    },
  });
  return { ok: true, userCode, deviceCode, expiresAt };
}

export type PendingPairing = { id: string; proposedName: string; proposedModel: string | null; expiresAt: Date };

/** The pairing a typed code names, if it can still be approved. */
export async function findPendingPairing(userCode: string, now = new Date()): Promise<PendingPairing | null> {
  const code = normalizeUserCode(userCode);
  if (!code) return null;
  return prisma.agentPairing.findFirst({
    where: { codeHash: hashSecret(code), approvedAt: null, expiresAt: { gt: now } },
    select: { id: true, proposedName: true, proposedModel: true, expiresAt: true },
  });
}

export type ApprovePairingResult = { ok: true; name: string } | { ok: false; error: string };

const CODE_NOT_FOUND = "That code doesn't match a waiting agent. It may have expired; ask the agent for a new one.";

/** The signed-in owner approves. Single use: the first approval wins. */
export async function approvePairing(owner: Actor, userCode: string, now = new Date()): Promise<ApprovePairingResult> {
  const code = normalizeUserCode(userCode);
  if (!code) return { ok: false, error: CODE_NOT_FOUND };
  const tenant = await tenantForOwner(owner.id);
  if (!tenant) return { ok: false, error: "Join or create a team before you register agents." };

  const codeHash = hashSecret(code);
  const approved = await prisma.agentPairing.updateMany({
    where: { codeHash, approvedAt: null, ownerUserId: null, expiresAt: { gt: now } },
    data: { ownerUserId: owner.id, tenantId: tenant.tenantId, approvedAt: now },
  });
  if (approved.count !== 1) return { ok: false, error: CODE_NOT_FOUND };
  const pairing = await prisma.agentPairing.findUniqueOrThrow({ where: { codeHash }, select: { proposedName: true } });
  return { ok: true, name: pairing.proposedName };
}

export type CollectResult =
  | { status: "issued"; key: IssuedKey }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "used" }
  | { status: "invalid" };

/** The waiting agent polls. Returns the key exactly once after approval. */
export async function collectPairing(deviceCode: unknown, now = new Date()): Promise<CollectResult> {
  if (typeof deviceCode !== "string" || deviceCode.length < 20 || deviceCode.length > 200) {
    return { status: "invalid" };
  }
  const deviceCodeHash = hashSecret(deviceCode);
  const pairing = await prisma.agentPairing.findUnique({
    where: { deviceCodeHash },
    select: {
      id: true,
      proposedName: true,
      proposedModel: true,
      expiresAt: true,
      approvedAt: true,
      consumedAt: true,
      ownerUserId: true,
      tenantId: true,
    },
  });
  if (!pairing) return { status: "invalid" };
  if (pairing.consumedAt) return { status: "used" };
  if (!pairing.approvedAt || !pairing.ownerUserId || !pairing.tenantId) {
    return pairing.expiresAt <= now ? { status: "expired" } : { status: "pending" };
  }
  // Approved in time: collecting may finish after the code's expiry, but
  // not long after, so an approved code isn't usable forever.
  if (pairing.expiresAt.getTime() + PAIRING_TTL_MS <= now.getTime()) return { status: "expired" };

  const { ownerUserId, tenantId } = pairing;
  return prisma.$transaction(async (tx) => {
    // Two polls racing: only one marks it consumed and gets the key.
    const claimed = await tx.agentPairing.updateMany({
      where: { id: pairing.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) return { status: "used" } as const;
    const key = await insertAgentWithKey(tx, {
      tenantId,
      ownerUserId,
      name: pairing.proposedName,
      model: pairing.proposedModel,
      level: DEFAULT_AGENT_LEVEL,
    });
    await tx.agentPairing.update({ where: { id: pairing.id }, data: { agentId: key.agentId } });
    await audit(
      { agentId: key.agentId, tenantId },
      "agent.created",
      `agent:${key.agentId}`,
      { name: key.name, model: pairing.proposedModel, level: DEFAULT_AGENT_LEVEL, via: "pairing" },
      { actorUserId: ownerUserId, db: tx },
    );
    return { status: "issued", key } as const;
  });
}
