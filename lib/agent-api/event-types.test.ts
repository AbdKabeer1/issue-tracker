import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_EVENT_TYPES } from "./events";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

/** Every literal `type` passed to `publish()` or `publishWebEvent()` in production code. */
function publishedTypes(): Set<string> {
  const types = new Set<string>();
  for (const file of [...walk("lib"), ...walk("app")]) {
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(
      /(?:publish|publishWebEvent)\(\s*(?:tx|db|prisma)?\s*,\s*\{([\s\S]{0,700}?)\}\s*\)/g,
    )) {
      const type = /(?:[{,]\s*|\n\s*)type:\s*"([a-z._]+)"/.exec(call[1]!);
      if (type && type[1] !== "user") types.add(type[1]!);
    }
  }
  return types;
}

/**
 * Drift guards for the agent event catalogue (#534): the constant, the code
 * and the public doc must name exactly the same events.
 */
describe("agent event types (#534)", () => {
  it("lists exactly the types the code publishes", () => {
    expect(new Set(AGENT_EVENT_TYPES)).toEqual(publishedTypes());
  });

  it("documents exactly the types the code publishes", () => {
    const doc = readFileSync("docs/ziki-for-agents.md", "utf8");
    const list = /"type":\s*"([a-z._|]+)"/.exec(doc);
    expect(list).not.toBeNull();
    expect(new Set(list![1]!.split("|"))).toEqual(new Set(AGENT_EVENT_TYPES));
  });
});
