import { PrismaClient } from "@prisma/client";

/** Direct database access for the seed and for set-up inside a spec. */
export function e2eDb(): PrismaClient {
  return new PrismaClient();
}
