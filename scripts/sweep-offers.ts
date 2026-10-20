/**
 * Sweep and release expired ticket offers (#681).
 *
 *   pnpm tsx scripts/sweep-offers.ts
 *
 * Operator-run or cron-run against the database in DATABASE_URL.
 */
import { sweepExpiredOffers } from "../lib/agent-api/offer";

async function main() {
  const result = await sweepExpiredOffers();
  console.log(`Swept ${result.expired} expired offer(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
