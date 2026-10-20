import { describe, expect, it } from "vitest";
import {
  claudePromptTemplate,
  chatGptPromptTemplate,
  nodeScriptTemplate,
  pythonScriptTemplate,
  getAgentTemplates,
} from "./templates";

describe("Agent Onboarding Templates (#610)", () => {
  const origin = "https://ziki.dev";
  const projectId = "proj_alpha";
  const projectName = "Alpha Project";

  describe("claudePromptTemplate", () => {
    it("embeds origin, projectId, projectName, and llms.txt link", () => {
      const prompt = claudePromptTemplate({ origin, projectId, projectName });
      expect(prompt).toContain("https://ziki.dev");
      expect(prompt).toContain("proj_alpha");
      expect(prompt).toContain("Alpha Project");
      expect(prompt).toContain("https://ziki.dev/llms.txt");
      expect(prompt).toContain("POST https://ziki.dev/api/v1/agents/pairing");
      expect(prompt).toContain("POST https://ziki.dev/api/v1/agents/pairing/token");
      expect(prompt).toContain("GET https://ziki.dev/api/v1/agents/me");
    });

    it("never embeds hardcoded secrets or existing keys", () => {
      const prompt = claudePromptTemplate({ origin, projectId, projectName });
      expect(prompt).not.toContain("ziki_ak_");
      expect(prompt).not.toContain("eyJ");
    });
  });

  describe("chatGptPromptTemplate", () => {
    it("adapts instructions for ChatGPT and includes origin and project", () => {
      const prompt = chatGptPromptTemplate({ origin, projectId, projectName });
      expect(prompt).toContain("https://ziki.dev");
      expect(prompt).toContain("proj_alpha");
      expect(prompt).toContain("https://ziki.dev/llms.txt");
      expect(prompt).toContain("https://ziki.dev/api/v1/agents/pairing");
      expect(prompt).toContain("https://ziki.dev/api/v1/agents/me");
      expect(prompt).not.toContain("ziki_ak_");
    });
  });

  describe("nodeScriptTemplate", () => {
    it("generates a complete Node.js poller without secrets", () => {
      const script = nodeScriptTemplate({ origin, projectId, projectName });
      expect(script).toContain('const SITE = "https://ziki.dev";');
      expect(script).toContain('const PROJECT_ID = "proj_alpha";');
      expect(script).toContain("/api/v1/agents/pairing");
      expect(script).toContain("/api/v1/agents/pairing/token");
      expect(script).toContain("/api/v1/agents/me");
      expect(script).toContain("/api/v1/events");
      expect(script).not.toContain("ziki_ak_");
    });
  });

  describe("pythonScriptTemplate", () => {
    it("generates a complete Python 3 poller without secrets", () => {
      const script = pythonScriptTemplate({ origin, projectId, projectName });
      expect(script).toContain('SITE = "https://ziki.dev"');
      expect(script).toContain('PROJECT_ID = "proj_alpha"');
      expect(script).toContain("/api/v1/agents/pairing");
      expect(script).toContain("/api/v1/agents/pairing/token");
      expect(script).toContain("/api/v1/agents/me");
      expect(script).toContain("/api/v1/events");
      expect(script).toContain("import urllib.request");
      expect(script).not.toContain("ziki_ak_");
    });
  });

  describe("getAgentTemplates", () => {
    it("returns all four templates in a single call", () => {
      const templates = getAgentTemplates({ origin, projectId, projectName });
      expect(templates.claude).toBeTruthy();
      expect(templates.chatgpt).toBeTruthy();
      expect(templates.node).toBeTruthy();
      expect(templates.python).toBeTruthy();
    });
  });
});
