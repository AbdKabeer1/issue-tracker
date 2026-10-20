import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { isBugNumberConflict, repairBugNumberSequence } from "./bug-number";

describe("issue number sequence", () => {
  it("recognises a unique violation on the issue number", () => {
    const onNumber = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6",
      meta: { target: ["number"] },
    });
    const onIndex = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6",
      meta: { target: "Bug_number_key" },
    });
    const onTitle = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6",
      meta: { target: ["title"] },
    });
    expect(isBugNumberConflict(onNumber)).toBe(true);
    expect(isBugNumberConflict(onIndex)).toBe(true);
    expect(isBugNumberConflict(onTitle)).toBe(false);
    expect(isBugNumberConflict(new Error("stop after create"))).toBe(false);
  });

  it("moves the sequence to the next free number", async () => {
    const execute = vi.fn(async (query: TemplateStringsArray) => {
      void query;
      return 0;
    });
    await repairBugNumberSequence({ $executeRaw: execute });
    const sql = execute.mock.calls[0][0].join("");
    expect(sql).toContain('"Bug_number_seq"');
    expect(sql).toContain('MAX("number")');
  });
});
