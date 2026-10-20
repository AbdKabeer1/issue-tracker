import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Webhook deliveries must actually get scheduled (#583). */
describe("vercel.json cron (#583)", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };

  it("schedules the webhook dispatcher at least once a minute", () => {
    const cron = config.crons?.find((entry) => entry.path === "/api/v1/webhooks/dispatch");
    expect(cron).toBeDefined();
    expect(cron!.schedule).toBe("* * * * *");
  });
});
