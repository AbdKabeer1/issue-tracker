import type { AgentLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bearerToken, hashSecret } from "@/lib/agents/keys";
import { AgentLevelError } from "@/lib/agents/levels";

/**
 * Who is calling (#427). Every agent route starts with `requireAgent()`.
 * It looks the key up by its hash and checks that the key and the agent are
 * live, and that the owner still belongs to the agent's tenant. It writes
 * nothing; routes record what they did with `audit()`.
 *
 * The owner always comes from the agent row, never from the request body.
 */
export type AgentContext = {
  agentId: string;
  name: string;
  ownerId: string;
  tenantId: string;
  level: AgentLevel;
  /** For the rate budget (#440). */
  burst: boolean;
  /** The key used for this call, so rotation can revoke exactly it. */
  keyId: string;
};

export type AgentAuthFailure = "missing_key" | "invalid_key" | "revoked";

const MESSAGES: Record<AgentAuthFailure, string> = {
  missing_key: "Send your agent key as Authorization: Bearer <key>.",
  invalid_key: "That agent key is not valid.",
  revoked: "That agent key has been revoked.",
};

export class AgentAuthError extends Error {
  readonly code: AgentAuthFailure;

  constructor(code: AgentAuthFailure) {
    super(MESSAGES[code]);
    this.name = "AgentAuthError";
    this.code = code;
  }
}

type HeaderSource = { headers: { get(name: string): string | null } };

const LAST_USED_THROTTLE_MS = 60 * 1000;

export async function requireAgent(request: HeaderSource): Promise<AgentContext> {
  const raw = bearerToken(request.headers.get("authorization"));
  if (!raw) throw new AgentAuthError("missing_key");

  const key = await prisma.agentApiKey.findUnique({
    where: { keyHash: hashSecret(raw) },
    select: {
      id: true,
      lastUsedAt: true,
      revokedAt: true,
      agent: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
          tenantId: true,
          level: true,
          burst: true,
          revokedAt: true,
          owner: { select: { memberships: { select: { tenantId: true } } } },
        },
      },
    },
  });
  if (!key) throw new AgentAuthError("invalid_key");
  const { agent } = key;
  if (key.revokedAt || agent.revokedAt) throw new AgentAuthError("revoked");
  // An owner who left the tenant takes their agents' access with them.
  const ownerInTenant = agent.owner.memberships.some((m) => m.tenantId === agent.tenantId);
  if (!agent.name || !agent.ownerUserId || !agent.tenantId || !ownerInTenant) {
    throw new AgentAuthError("invalid_key");
  }

  // Update lastUsedAt on successful auth, throttled to at most once per minute (#535)
  const now = new Date();
  if (
    typeof prisma.agentApiKey?.update === "function" &&
    (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS)
  ) {
    await Promise.resolve(
      prisma.agentApiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: now },
      }),
    ).catch((error) => {
      console.error("[requireAgent] failed to update lastUsedAt", error);
    });
  }

  return {
    agentId: agent.id,
    name: agent.name,
    ownerId: agent.ownerUserId,
    tenantId: agent.tenantId,
    level: agent.level,
    burst: agent.burst,
    keyId: key.id,
  };
}

/**
 * The response for a failed `requireAgent()` or `requireLevel()`: 401 for a
 * missing or bad key, 403 for too low a level. Anything else is rethrown.
 */
export function agentErrorResponse(error: unknown): NextResponse {
  if (error instanceof AgentAuthError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="ziki"' } },
    );
  }
  if (error instanceof AgentLevelError) {
    return NextResponse.json(
      { error: "insufficient_level", message: error.message, required: error.required },
      { status: 403 },
    );
  }
  throw error;
}
