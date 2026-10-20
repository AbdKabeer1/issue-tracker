import { NextResponse } from "next/server";

/**
 * The agent platform is switched off on this site (#505). Hiding the
 * settings pages isn't enough: every key, pairing request and agent route
 * has to stop too, or "disabled" only means "you can't see it".
 */
export class AgentPlatformDisabledError extends Error {
  readonly code = "agent_platform_disabled" as const;

  constructor() {
    super("The agent platform is turned off on this site.");
    this.name = "AgentPlatformDisabledError";
  }
}

/** 404, as if the route didn't exist, for every agent endpoint while the platform is off. */
export function agentPlatformDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "agent_platform_disabled", message: "The agent platform is turned off on this site." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
