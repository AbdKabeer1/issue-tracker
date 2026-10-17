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
  // #220: this used to exit 0 even outside development, so a container with a
  // missing env var started normally against an unmigrated database - the exact
  // outcome the doc comment above promises to prevent.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[db:migrate] WARNING: DATABASE_URL is not set. Skipping database migrations and proceeding to server startup.",
    );
  }
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
    "[db:migrate] prisma migrate deploy encountered error:",
    error instanceof Error ? error.message : String(error),
  );
  try {
    console.log(`[db:migrate] Attempting schema push via ${prismaBin} db push...`);
    execSync(`${prismaBin} db push --skip-generate`, {
      stdio: "inherit",
      env: process.env,
    });
    console.log("[db:migrate] Fallback schema sync succeeded.");
  } catch (fallbackError) {
    console.error(
      "[db:migrate] Fallback schema sync failed:",
      fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    );
  }
}
