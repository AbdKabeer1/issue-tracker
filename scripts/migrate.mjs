import { execSync } from "child_process";
import { existsSync } from "fs";

/**
 * Container start step: apply pending Prisma migrations, nothing else (#112).
 *
 * Production schema changes must go through reviewed migrations. This script
 * used to follow `migrate deploy` with `prisma db push --accept-data-loss`,
 * which silently drops columns/tables that schema.prisma no longer has.
 *
 * Exits non-zero when migrations fail so the Dockerfile's `&&` keeps the new
 * container from starting against a half-migrated database.
 */

let url = process.env.DATABASE_URL;
if (url) {
  url = url.trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  process.env.DATABASE_URL = url;
}

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db:migrate] WARNING: DATABASE_URL is not set. Skipping database migrations.",
  );
  process.exit(0);
}

const prismaBin = existsSync("./node_modules/.bin/prisma")
  ? "./node_modules/.bin/prisma"
  : "pnpm exec prisma";

try {
  console.log(`[db:migrate] Running ${prismaBin} migrate deploy...`);
  execSync(`${prismaBin} migrate deploy`, {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[db:migrate] Migrations applied.");
} catch (error) {
  console.error(
    "[db:migrate] prisma migrate deploy failed; refusing to start the app.",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
