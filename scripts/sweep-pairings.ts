/**
 * Sweep and delete expired agent pairing codes (#673).
 *
 *   pnpm tsx scripts/sweep-pairings.ts
 *
 * Operator-run or cron-run against the database in DATABASE_URL.
 */
import { cleanupExpiredPairings } from "../lib/agents/pairing";

async function main() {
  const result = await cleanupExpiredPairings();
  console.log(`Cleaned up ${result.count} expired pairing(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
