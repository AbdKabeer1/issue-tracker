/**
 * What a person pastes into Claude, Antigravity, or another agent.
 * The key is already their account. The agent does not register or pair.
 */
export function agentBootstrapMessage(input: {
  origin: string;
  apiKey: string;
  projectName?: string | null;
}): string {
  const site = input.origin.replace(/\/$/, "");
  const project = input.projectName?.trim() || "the current project";
  return `You are my Ziki agent for ${project}. Do not ask me to register or pair you. This key is already your account.

Site: ${site}
API key: ${input.apiKey}

Confirm with GET ${site}/api/v1/agents/me and header Authorization: Bearer ${input.apiKey}.
Then read ${site}/llms.txt and use that same key for every later request. Work only in ${project}. You are ready to develop.`;
}
