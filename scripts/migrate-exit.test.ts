import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Runs scripts/migrate.mjs against a stand-in `prisma` binary, so the exit
 * code can be checked without a database (#580).
 */
const dirs: string[] = [];

function run(prismaExitCode: number, env: Record<string, string | undefined>) {
  const dir = mkdtempSync(join(tmpdir(), "migrate-exit-"));
  dirs.push(dir);
  mkdirSync(join(dir, "scripts"));
  cpSync("scripts/migrate.mjs", join(dir, "scripts/migrate.mjs"));
  mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
  const prisma = join(dir, "node_modules/.bin/prisma");
  writeFileSync(prisma, `#!/bin/sh\necho "prisma $*" >> "${join(dir, "calls.log")}"\nexit ${prismaExitCode}\n`);
  chmodSync(prisma, 0o755);
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: dir,
    // Only what the script needs, so the parent's NODE_ENV and DATABASE_URL don't leak in.
    env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
  const calls = (() => {
    try {
      return readFileSync(join(dir, "calls.log"), "utf8");
    } catch {
      return "";
    }
  })();
  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const DB = "postgresql://u:p@localhost:5432/db";

describe("scripts/migrate.mjs exit code (#580)", () => {
  it("exits 0 when migrations apply", () => {
    const { status, calls } = run(0, { NODE_ENV: "production", DATABASE_URL: DB });
    expect(status).toBe(0);
    expect(calls).toContain("prisma migrate deploy");
  });

  it("exits non-zero in production when migrations still fail after every repair", () => {
    const { status, output } = run(1, { NODE_ENV: "production", DATABASE_URL: DB });
    expect(status).toBe(1);
    expect(output).toContain("Not starting the server");
  });

  it("can be told to start anyway during an incident", () => {
    const { status } = run(1, { NODE_ENV: "production", DATABASE_URL: DB, ALLOW_START_WITH_FAILED_MIGRATION: "true" });
    expect(status).toBe(0);
  });

  it("only warns outside production", () => {
    const { status, output } = run(1, { NODE_ENV: "development", DATABASE_URL: DB });
    expect(status).toBe(0);
    expect(output).toContain("Continuing outside production");
  });

  it("refuses to start in production with no DATABASE_URL (#220)", () => {
    const { status, calls } = run(0, { NODE_ENV: "production" });
    expect(status).toBe(1);
    expect(calls).toBe("");
  });

  it("the Dockerfile only starts the server when the script succeeds", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    expect(dockerfile).toMatch(/node scripts\/migrate\.mjs && (pnpm run start|node server\.js)/);
    expect(dockerfile).not.toContain("migrate.mjs || true");
  });
});
