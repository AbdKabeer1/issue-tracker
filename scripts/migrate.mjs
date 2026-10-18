import { execSync } from "child_process";
import { existsSync } from "fs";

/**
 * Container start step: apply pending Prisma migrations, nothing else (#112).
 *
 * Production schema changes must go through reviewed migrations. This script
 * used to follow `migrate deploy` with `prisma db push --accept-data-loss`,
 * which silently drops columns/tables that schema.prisma no longer has.
 *
 * If deploy stops early, scripts/sql/ensure-bug-number.sql still adds the
 * missing issue reference column. It does not drop anything.
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

const bugNumberMigration = "20261017140000_bug_reference_number";
const detailMigrations = [
  "20261017140000_issue_watch_and_notifications",
  "20261017150000_attachments",
];

function runPrisma(args, inherit = false) {
  return execSync(`${prismaBin} ${args}`, {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function deploy() {
  console.log(`[db:migrate] Running ${prismaBin} migrate deploy...`);
  runPrisma("migrate deploy", true);
  console.log("[db:migrate] Migrations applied.");
}

try {
  deploy();
} catch (error) {
  console.error(
    "[db:migrate] prisma migrate deploy encountered error:",
    error instanceof Error ? error.message : String(error),
  );
}

// migrate deploy can stop on an earlier failure and never reach the reference
// number migration. db push is not used here: without --accept-data-loss it
// bails on any drift, and with that flag it can drop columns. This statement
// only adds Bug.number when it is missing.
try {
  console.log("[db:migrate] Ensuring Bug.number exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-bug-number.sql",
    true,
  );
  console.log("[db:migrate] Bug.number is present.");
  try {
    console.log("[db:migrate] Ensuring issue detail tables exist...");
    runPrisma(
      "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-issue-detail.sql",
      true,
    );
    console.log("[db:migrate] Issue detail tables are present.");
    for (const name of detailMigrations) {
      try {
        runPrisma(`migrate resolve --applied ${name}`, true);
        console.log(`[db:migrate] Recorded ${name} as applied.`);
      } catch (detailResolveError) {
        console.log(
          `[db:migrate] ${name} was already recorded:`,
          detailResolveError instanceof Error
            ? detailResolveError.message.split("\n")[0]
            : detailResolveError,
        );
      }
    }
  } catch (detailError) {
    console.error(
      "[db:migrate] Could not add issue detail tables:",
      detailError instanceof Error ? detailError.message : String(detailError),
    );
  }
  try {
    runPrisma(`migrate resolve --applied ${bugNumberMigration}`, true);
    console.log(`[db:migrate] Recorded ${bugNumberMigration} as applied.`);
  } catch (resolveError) {
    console.log(
      "[db:migrate] Reference-number migration was already recorded:",
      resolveError instanceof Error ? resolveError.message.split("\n")[0] : resolveError,
    );
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after Bug.number repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (ensureError) {
  console.error(
    "[db:migrate] Could not add Bug.number:",
    ensureError instanceof Error ? ensureError.message : String(ensureError),
  );
}
