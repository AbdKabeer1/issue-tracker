import { readFileSync } from "node:fs";
import path from "node:path";
import type { AgentLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AGENT_LEVELS } from "./levels";

/**
 * The Agent Levels table in the agent docs (served as /llms.txt) must agree
 * with each route's own `**Level:**` line (Ziki #464). Every route sits in the
 * row of the lowest level that can call it; this fails when a route is added,
 * moved or dropped on one side only.
 */
const doc = readFileSync(path.resolve(__dirname, "../../docs/ziki-for-agents.md"), "utf8");

const ROUTE = /^(GET|POST|PUT|PATCH|DELETE) \/api\/v1\/\S+$/;

/** Routes listed in each row of the Agent Levels table. */
function tableRoutes(): Map<AgentLevel, Set<string>> {
  const rows = new Map<AgentLevel, Set<string>>();
  for (const level of AGENT_LEVELS) {
    const row = new RegExp(`^\\|\\s*\`${level}\`\\s*\\|[^|]*\\|(.*)\\|\\s*$`, "m").exec(doc);
    if (!row) throw new Error(`No "${level}" row in the Agent Levels table`);
    const routes = [...row[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((t) => ROUTE.test(t));
    rows.set(level, new Set(routes));
  }
  return rows;
}

/** The level each route's section states, from its first backticked level. */
function sectionLevels(): Map<string, AgentLevel> {
  const levels = new Map<string, AgentLevel>();
  let heading: string | null = null;
  for (const line of doc.split("\n")) {
    const h = /^### `?((?:GET|POST|PUT|PATCH|DELETE) \/api\/v1\/\S+?)`?\s*$/.exec(line);
    if (h) {
      heading = h[1];
      continue;
    }
    if (line.startsWith("### ") || line.startsWith("## ")) heading = null;
    const level = /^\*\*Level:\*\* `(\w+)`/.exec(line);
    if (heading && level && (AGENT_LEVELS as readonly string[]).includes(level[1])) {
      levels.set(heading, level[1] as AgentLevel);
      heading = null;
    }
  }
  return levels;
}

describe("llms.txt Agent Levels table matches the per-route Level lines (#464)", () => {
  const rows = tableRoutes();
  const sections = sectionLevels();

  it("finds the documented routes", () => {
    expect(sections.size).toBeGreaterThan(50);
  });

  it("lists every route under the level its section states", () => {
    const missing = [...sections]
      .filter(([route, level]) => !rows.get(level)!.has(route))
      .map(([route, level]) => `${route} (${level})`);
    expect(missing).toEqual([]);
  });

  it("lists no route that its section puts at a different level", () => {
    const misplaced: string[] = [];
    for (const [level, routes] of rows) {
      for (const route of routes) {
        const stated = sections.get(route);
        // POST /issues/{id}/validations is triager for duplicates, reviewer otherwise.
        if (route === "POST /api/v1/issues/{id}/validations" && level === "triager") continue;
        if (stated !== level) misplaced.push(`${route}: table ${level}, section ${stated ?? "none"}`);
      }
    }
    expect(misplaced).toEqual([]);
  });

  it("gives the inbox and the event stream a Level line", () => {
    for (const route of ["GET /api/v1/inbox", "POST /api/v1/inbox/read", "GET /api/v1/events/stream"]) {
      expect(sections.get(route)).toBe("observer");
    }
  });
});
