export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPointsBackfill } = await import("@/lib/points/backfill-on-start");
    startPointsBackfill();
  }
}
