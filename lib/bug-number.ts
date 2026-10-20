import { Prisma } from "@prisma/client";

/**
 * Creating an issue can fail with a unique violation on `Bug.number` when
 * `Bug_number_seq` has fallen behind `MAX(number)`. That surfaces as a server
 * error on the report form. Repairing the sequence and retrying once lets the
 * insert use the next free number.
 */

type SequenceClient = {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

export function isBugNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  const parts = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return parts.some((part) => {
    const value = String(part);
    return value === "number" || value === "Bug_number_key";
  });
}

/** Next `nextval` returns `MAX(number) + 1`. The third argument is `is_called = false`. */
export async function repairBugNumberSequence(db: SequenceClient): Promise<void> {
  await db.$executeRaw`SELECT setval('"Bug_number_seq"', COALESCE((SELECT MAX("number") FROM "Bug"), 0) + 1, false)`;
}
