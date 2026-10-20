/** Simple feature-flag helpers for server and client code.
 * Feature flags are read from NEXT_PUBLIC_* (for client) or plain env vars for server.
 * The Agent Platform is enabled by default unless explicitly disabled with "false".
 */
export function isAgentPlatformEnabled(): boolean {
  const publicFlag = process.env.NEXT_PUBLIC_AGENT_PLATFORM;
  const serverFlag = process.env.AGENT_PLATFORM;
  if (typeof publicFlag === "string") return publicFlag.toLowerCase() !== "false";
  if (typeof serverFlag === "string") return serverFlag.toLowerCase() !== "false";
  return true;
}

export const AGENT_PLATFORM_FLAG = "AGENT_PLATFORM";
