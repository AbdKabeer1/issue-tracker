/**
 * Award points for tickets that existed before the ledger (#435).
 *
 *   pnpm tsx scripts/backfill-points.ts --dry-run   # print what it would award
 *   pnpm tsx scripts/backfill-points.ts             # award it
 *
 * Operator-run against the database in DATABASE_URL. Safe to run again:
 * entries already in the ledger are skipped. It never seeds or resets.
 */
import { PrismaClient } from "@prisma/client";
import { cleanEnv } from "../lib/env-clean";
import { backfillPoints, type BackfillLine } from "../lib/points/backfill";

function describe(line: BackfillLine): string {
  const state = line.alreadyAwarded ? "skip (already awarded)" : "award";
  return `${state.padEnd(22)} ${line.role.padEnd(8)} +${String(line.points).padEnd(3)} user=${line.userId} bug=${line.bugId}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verbose = dryRun || process.argv.includes("--verbose");
  const cutoffArg = process.argv.find((a) => a.startsWith("--cutoff="));
  const cutoffIdx = process.argv.indexOf("--cutoff");
  const cutoffStr = cutoffArg
    ? cutoffArg.split("=")[1]
    : cutoffIdx !== -1 && process.argv[cutoffIdx + 1] && !process.argv[cutoffIdx + 1].startsWith("-")
      ? process.argv[cutoffIdx + 1]
      : undefined;
  const cutoffDate = cutoffStr ? new Date(cutoffStr) : undefined;
  const url = cleanEnv(process.env.DATABASE_URL);
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

  try {
    console.log(dryRun ? "Dry run: nothing will be written.\n" : "Backfilling points.\n");
    const result = await backfillPoints(prisma, {
      dryRun,
      cutoffDate,
      onLine: verbose ? (line) => console.log(describe(line)) : undefined,
    });
    console.log(
      `\n${result.bugs} tickets, ${result.planned} entries by the rules, ` +
        `${result.existing} already awarded, ${dryRun ? "0 written (dry run)" : `${result.written} written`}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
