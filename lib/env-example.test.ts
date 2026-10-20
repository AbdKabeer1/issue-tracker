import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every environment variable the app reads is listed in .env.example (#553),
 * so self-hosting from the example doesn't silently leave a feature broken.
 * A variable counts as listed when a line sets it, commented out or not.
 */
const ROOT = join(__dirname, "..");
const SOURCES = ["app", "lib", "components", "scripts", "prisma", "auth.ts", "auth.config.ts", "middleware.ts", "next.config.ts"];
/** Set by Node, Next.js or the host, not by whoever deploys the app. */
const PLATFORM = new Set(["NODE_ENV", "NEXT_PHASE", "NEXT_RUNTIME", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "PORT", "HOSTNAME"]);

function files(path: string): string[] {
  const full = join(ROOT, path);
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return [];
  }
  if (stat.isFile()) return [full];
  return readdirSync(full).flatMap((name) =>
    name === "node_modules" || name.startsWith(".") ? [] : files(relative(ROOT, join(full, name))),
  );
}

function variablesReadByTheApp(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of SOURCES.flatMap(files)) {
    if (!/\.(ts|tsx|mjs|js)$/.test(file) || /\.test\.|\.spec\./.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      if (!found.has(match[1])) found.set(match[1], relative(ROOT, file));
    }
  }
  return found;
}

describe(".env.example (#553)", () => {
  it("lists every variable the app reads", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    const listed = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
    const missing = [...variablesReadByTheApp()]
      .filter(([name]) => !PLATFORM.has(name) && !listed.has(name))
      .map(([name, file]) => `${name} (read in ${file})`);
    expect(missing).toEqual([]);
  });
});
