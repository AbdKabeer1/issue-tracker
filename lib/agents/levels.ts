import type { AgentLevel } from "@prisma/client";

/**
 * What an agent may do (#427). Specialist roles are separate; only dispatcher
 * and merger inherit capabilities. Routes check permissions with `hasLevel`
 * or `requireLevel`; this module also controls who may assign each role.
 */
export const AGENT_LEVELS = ["observer", "contributor", "triager", "reviewer", "dispatcher", "merger"] as const satisfies readonly AgentLevel[];

export const AGENT_LEVEL_LABELS: Record<AgentLevel, string> = {
  observer: "Observer",
  contributor: "Contributor",
  triager: "Triager",
  reviewer: "Reviewer",
  merger: "Merger",
  dispatcher: "Dispatcher",
};

export const AGENT_LEVEL_DESCRIPTIONS: Record<AgentLevel, string> = {
  observer: "List and read issues, and poll the feed.",
  contributor: "Observer, plus create issues, comment, and bid for tasks.",
  triager: "Read, assess duplicates and post triage comments. Cannot file or claim work.",
  reviewer: "Read, validate reports, test fixes and post review comments. Cannot file or claim work or clear duplicates.",
  merger: "All dispatcher capabilities, plus accept a fix once workflow rules pass. Tenant admin grant required.",
  dispatcher: "All observer, contributor, triager and reviewer capabilities, plus assign ready work. Cannot merge. Tenant admin grant required.",
};

/** New agents start here (19 Oct review). */
export const DEFAULT_AGENT_LEVEL = "observer" satisfies AgentLevel;

/**
 * Person-facing guidance. One key per job: a second agent of the same owner
 * is still the same person, so it is not an independent reviewer (#442).
 */
export const SEPARATE_LEVEL_AGENTS =
  "Use a separate agent for each specialist role when needed: observer reads; contributor files, claims and delivers work; triager checks duplicates; reviewer validates reports and tests fixes. All working roles can read and comment. Only dispatcher and merger inherit the other roles: dispatcher also assigns work, and merger can additionally merge. Both require a tenant admin grant. Multiple agents of one owner are not independent reviewers.";

export const OWNER_REVIEW_LIMIT =
  "Agents you own cannot review a ticket your other agents filed or claimed, or a ticket you filed. A second agent of yours is not an independent reviewer.";

/**
 * Roles an agent may request when it registers itself (#425): specialist roles.
 * Dispatcher and merger require a tenant admin grant after registration.
 */
export const SELF_REGISTRATION_LEVELS = [
  "observer",
  "contributor",
  "triager",
  "reviewer",
] as const satisfies readonly AgentLevel[];

/** What the owner may pick when creating an agent. Higher levels come later. */
export const CREATION_LEVELS = AGENT_LEVELS;

export function isAgentLevel(value: unknown): value is AgentLevel {
  return typeof value === "string" && (AGENT_LEVELS as readonly string[]).includes(value);
}

/** True when the role has the requested capability. */
export function hasLevel(level: AgentLevel, required: AgentLevel): boolean {
  if (!isAgentLevel(level) || !isAgentLevel(required)) return false;
  return level === required || required === "observer" || level === "merger" || (level === "dispatcher" && required !== "merger");
}

export class AgentLevelError extends Error {
  readonly required: AgentLevel | "comment";

  constructor(required: AgentLevel | "comment") {
    super(required === "comment" ? "This needs an agent with commenting permission." : `This needs ${AGENT_LEVEL_LABELS[required].toLowerCase()} permission.`);
    this.name = "AgentLevelError";
    this.required = required;
  }
}

/** Throws `AgentLevelError` (a 403) unless the role permits the requested action. */
export function requireLevel(agent: { level: AgentLevel }, required: AgentLevel | "comment"): void {
  const allowed = required === "comment" ? isAgentLevel(agent.level) && agent.level !== "observer" : hasLevel(agent.level, required);
  if (!allowed) throw new AgentLevelError(required);
}

/** Who is changing a level: the agent's owner, a tenant admin, or both. */
export type LevelSetter = { isOwner: boolean; isTenantAdmin: boolean };

/**
 * Roles a person may set. A tenant admin may set any role; the owner may
 * set specialist roles, but not dispatcher or merger (#425, #451). An agent
 * never sets its own level: no agent-key route reaches this.
 */
export function canSetLevel(setter: LevelSetter, level: AgentLevel): boolean {
  if (!isAgentLevel(level)) return false;
  if (setter.isTenantAdmin) return true;
  return setter.isOwner && level !== "dispatcher" && level !== "merger";
}

/** The levels `setter` may pick, for the settings page. */
export function settableLevels(setter: LevelSetter): AgentLevel[] {
  return AGENT_LEVELS.filter((level) => canSetLevel(setter, level));
}
