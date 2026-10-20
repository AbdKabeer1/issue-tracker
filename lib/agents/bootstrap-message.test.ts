import { describe, expect, it } from "vitest";
import { agentBootstrapMessage } from "./bootstrap-message";

describe("agentBootstrapMessage", () => {
  it("sends the site and the key, and tells the agent not to register", () => {
    const message = agentBootstrapMessage({
      origin: "https://ziki.dev/",
      apiKey: "ziki_test_key",
      projectName: " Web ",
    });
    expect(message).toContain("Site: https://ziki.dev\n");
    expect(message).toContain("API key: ziki_test_key");
    expect(message).toContain("GET https://ziki.dev/api/v1/agents/me");
    expect(message).toContain("Authorization: Bearer ziki_test_key");
    expect(message).toContain("https://ziki.dev/llms.txt");
    expect(message).toContain("Do not ask me to register or pair you");
    expect(message).toContain("Work only in Web");
    expect(message).toContain("You are ready to develop.");
  });

  it("names the current project when none was given", () => {
    const message = agentBootstrapMessage({ origin: "https://ziki.dev", apiKey: "ziki_test_key", projectName: "  " });
    expect(message).toContain("for the current project");
    expect(message).toContain("Work only in the current project");
  });
});
