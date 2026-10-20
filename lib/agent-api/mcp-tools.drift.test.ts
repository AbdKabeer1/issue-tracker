import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { TOOLS } from "../../packages/mcp-server/src/tools";
import { agentQuestionSchema } from "@/lib/agent-questions";
import { commentSchema, createBugSchema } from "@/lib/validations/issue";
import { bidSchema } from "./bid";
import { extendSchema } from "./deadline";
import { testVerdictBodySchema } from "./test-verdict";
import { validationBodySchema } from "./validation";

/**
 * The MCP server (packages/mcp-server) builds its tool inputs from its own zod
 * shapes. These checks fail when a route's body schema gains, renames or
 * requires a field the matching tool doesn't have, so the tools can't drift
 * from the API (#612).
 */
const ROUTE_SCHEMAS: Record<string, z.ZodType> = {
  ziki_create_issue: createBugSchema,
  ziki_comment: commentSchema,
  ziki_volunteer: bidSchema,
  ziki_extend_deadline: extendSchema,
  ziki_validate_issue: validationBodySchema,
  ziki_submit_test_result: testVerdictBodySchema,
  ziki_ask_owner: agentQuestionSchema,
};

// The agent routes extend the shared issue and comment schemas with attachmentIds (lib/agent-api/issues.ts).
const AGENT_LAYER_FIELDS = new Set(["attachmentIds"]);

// Fields on the shared schema that the agent route deliberately does not take (it picks only some of
// them, and severity is set by reviewers), so a tool must not offer them.
const NOT_OFFERED_TO_AGENTS: Record<string, readonly string[]> = {
  ziki_create_issue: ["severity", "typeId", "assigneeId"],
};

// Fields the route doesn't take from the body: the tool puts them in the path or query.
const NOT_BODY = new Set(["projectId", "id"]);

const shapeOf = (schema: z.ZodType) => (schema as unknown as { shape: Record<string, z.ZodType> }).shape;
const isRequired = (field: z.ZodType) => !field.safeParse(undefined).success;

describe("MCP tools match the route body schemas", () => {
  for (const [name, schema] of Object.entries(ROUTE_SCHEMAS)) {
    const tool = TOOLS.find((candidate) => candidate.name === name)!;

    it(`${name} only sends fields the route accepts`, () => {
      const routeKeys = [...Object.keys(shapeOf(schema)), ...AGENT_LAYER_FIELDS];
      for (const key of tool.body ?? []) {
        expect(routeKeys, `${name} sends ${key}, which the route rejects`).toContain(key);
      }
    });

    it(`${name} requires everything the route requires`, () => {
      for (const [key, field] of Object.entries(shapeOf(schema))) {
        if (NOT_BODY.has(key) || !isRequired(field)) continue;
        expect(tool.body ?? [], `${name} never sends required ${key}`).toContain(key);
        expect(isRequired(tool.input[key] as z.ZodType), `${name} must require ${key}`).toBe(true);
      }
    });
  }

  for (const [name, schema] of Object.entries(ROUTE_SCHEMAS)) {
    it(`${name} offers every field the route accepts, optional ones too (#969)`, () => {
      const tool = TOOLS.find((candidate) => candidate.name === name)!;
      const left = Object.keys(shapeOf(schema)).filter(
        (key) => !NOT_BODY.has(key) && !(NOT_OFFERED_TO_AGENTS[name] ?? []).includes(key) && !(tool.body ?? []).includes(key),
      );
      expect(left, `${name} cannot send ${left.join(", ")}`).toEqual([]);
    });
  }

  it("covers every tool that posts a JSON body to a route with an exported schema", () => {
    const bodyTools = TOOLS.filter((tool) => tool.body?.length).map((tool) => tool.name);
    // github, inbox/read and attachments have no exported body schema to compare.
    const unchecked = bodyTools.filter((name) => !(name in ROUTE_SCHEMAS));
    expect(unchecked.sort()).toEqual(["ziki_link_pull_request", "ziki_mark_inbox_read"]);
  });
});
