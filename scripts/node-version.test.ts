import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * One supported Node.js line everywhere (#584). Node 20 reached end of life on
 * 30 April 2026; Docker, CI, and local dev all use Node 22 LTS now.
 */
const NODE_MAJOR = "22";

describe("Node.js version (#584)", () => {
  it("is the same LTS line in Docker, CI, .nvmrc and package.json", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const froms = [...dockerfile.matchAll(/^FROM node:(\d+)/gm)].map((m) => m[1]);
    expect(froms.length).toBeGreaterThan(0);
    expect(new Set(froms)).toEqual(new Set([NODE_MAJOR]));

    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const versions = [...ci.matchAll(/node-version:\s*["']?(\d+)/g)].map((m) => m[1]);
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([NODE_MAJOR]));

    expect(readFileSync(".nvmrc", "utf8").trim()).toBe(NODE_MAJOR);
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.engines?.node).toBe(`${NODE_MAJOR}.x`);
  });

  it("this test run is on a supported Node.js", () => {
    expect(Number(process.versions.node.split(".")[0])).toBeGreaterThanOrEqual(Number(NODE_MAJOR));
  });
});
