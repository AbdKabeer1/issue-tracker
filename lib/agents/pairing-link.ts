/**
 * Instruction to open a verification link in the browser when the agent
 * has browser access; a no-op hint when it does not.
 */
export const OPEN_LINK_IF_YOU_CAN = "Open";

/**
 * Message shown to the agent when it collects its pairing key.
 */
export const PAIRING_LINK_MESSAGE =
  "Open verification_uri_complete in the owner's browser yourself. Do not only print it. They approve it while signed in. Then poll the token URL with device_code until api_key is returned.";
