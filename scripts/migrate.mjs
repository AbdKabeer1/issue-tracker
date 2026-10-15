import { execSync } from "child_process";

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

try {
  console.log("[db:migrate] Deploying pending Prisma migrations...");
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[db:migrate] Prisma migrations deployed successfully.");
} catch (error) {
  console.warn(
    "[db:migrate] Prisma migration completed with warnings or error:",
    error instanceof Error ? error.message : String(error),
  );
}
