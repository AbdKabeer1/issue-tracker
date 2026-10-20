import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The production image is slim and non-root (#585). */
const dockerfile = readFileSync("Dockerfile", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

describe("production image (#585)", () => {
  it("builds Next in standalone output", () => {
    expect(nextConfig).toMatch(/output:\s*["']standalone["']/);
  });

  it("runs the app as the unprivileged node user", () => {
    expect(dockerfile).toMatch(/^USER node$/m);
  });

  it("copies only the standalone server, static assets and migration files", () => {
    expect(dockerfile).toContain(".next/standalone");
    expect(dockerfile).toContain(".next/static");
    expect(dockerfile).toContain("./public");
    expect(dockerfile).toContain("./prisma");
    // The old runner copied the whole builder directory (devDeps, tests, docs).
    expect(dockerfile).not.toContain("COPY --from=builder /app ./");
  });

  it("starts the standalone server and keeps migrations + healthcheck", () => {
    expect(dockerfile).toContain("node server.js");
    expect(dockerfile).toContain("scripts/migrate.mjs");
    expect(dockerfile).toContain("HEALTHCHECK");
  });
});
