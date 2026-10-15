import { execSync } from "child_process";
import { existsSync } from "fs";

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

console.log("[db:migrate] Syncing database schema with Prisma...");

// 1. Attempt prisma migrate deploy to record formal migrations
try {
  console.log(`[db:migrate] Running ${prismaBin} migrate deploy...`);
  execSync(`${prismaBin} migrate deploy`, {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[db:migrate] prisma migrate deploy succeeded.");
} catch (error) {
  console.warn(
    "[db:migrate] prisma migrate deploy encountered warnings or drift:",
    error instanceof Error ? error.message : String(error),
  );
}

// 2. Run prisma db push to guarantee missing columns/enums exist (essential when switching databases)
try {
  console.log(
    `[db:migrate] Running ${prismaBin} db push --accept-data-loss --skip-generate...`,
  );
  execSync(`${prismaBin} db push --accept-data-loss --skip-generate`, {
    stdio: "inherit",
    env: process.env,
  });
  console.log(
    "[db:migrate] prisma db push completed. Database schema is fully in sync.",
  );
} catch (pushError) {
  console.error(
    "[db:migrate] prisma db push encountered error:",
    pushError instanceof Error ? pushError.message : String(pushError),
  );
}
