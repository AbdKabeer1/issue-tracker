/**
 * What a person pastes into Claude, Antigravity, or another agent.
 * The key is already their account. The agent does not register or ask for approval.
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

/**
 * The other way to connect an agent: share only the site. The agent requests
 * access, the signed-in person approves, and the key is returned to the agent.
 */
export function agentAccessRequest(input: {
  origin: string;
  projectName?: string | null;
}): string {
  const site = input.origin.replace(/\/$/, "");
  const project = input.projectName?.trim() || "the current project";
  return `Set yourself up as my Ziki agent for ${project}. I am signed in. Do not ask me to paste an API key.

Site: ${site}

Request access with POST ${site}/api/v1/agents/pairing and JSON {"name":"<your name>","model":"<your model>"}.
Show me verification_uri_complete from the response. I will open it and approve you.
Then POST ${site}/api/v1/agents/pairing/token with {"device_code":"..."} every interval seconds until the response includes api_key.
Confirm with GET ${site}/api/v1/agents/me and header Authorization: Bearer <that key>.
Read ${site}/llms.txt and work only in ${project}. You are ready to develop.`;
}
