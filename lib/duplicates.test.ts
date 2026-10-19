import { describe, expect, it } from "vitest";
import {
  DUPLICATE_ERRORS,
  duplicateLinkProblem,
  duplicatesWhere,
  parseIssueRef,
  parseShowDuplicates,
} from "./duplicates";

const side = (id: string, number: number, extra: Partial<{ isDeleted: boolean; duplicateOfId: string | null }> = {}) => ({
  id,
  number,
  isDeleted: false,
  duplicateOfId: null,
  ...extra,
});

describe("duplicateLinkProblem", () => {
  const a = side("a", 1);
  const b = side("b", 2);

  it("allows a plain link", () => {
    expect(duplicateLinkProblem(a, b, 0)).toBeNull();
  });
  it("refuses a self link", () => {
    expect(duplicateLinkProblem(a, a, 0)).toBe(DUPLICATE_ERRORS.self);
  });
  it("refuses a missing or deleted target", () => {
    expect(duplicateLinkProblem(a, null, 0)).toBe(DUPLICATE_ERRORS.notFound);
    expect(duplicateLinkProblem(a, side("b", 2, { isDeleted: true }), 0)).toBe(DUPLICATE_ERRORS.targetDeleted);
  });
  it("refuses a target that is itself a duplicate, naming its canonical issue", () => {
    const problem = duplicateLinkProblem(a, side("b", 2, { duplicateOfId: "c" }), 0, { number: 3 });
    expect(problem).toBe("#2 is itself a duplicate. Mark this one a duplicate of #3 instead.");
  });
  it("refuses to make an issue with duplicates of its own into a duplicate", () => {
    expect(duplicateLinkProblem(a, b, 2)).toMatch(/^2 issues are marked as duplicates of this one/);
    expect(duplicateLinkProblem(a, b, 1)).toMatch(/^1 issue is marked as duplicate of this one\. Point it at #2/);
  });
  it("allows re-pointing an existing duplicate at a different canonical issue", () => {
    expect(duplicateLinkProblem(side("a", 1, { duplicateOfId: "x" }), b, 0)).toBeNull();
  });
});

describe("list filter", () => {
  it("hides duplicates unless asked", () => {
    expect(parseShowDuplicates(undefined)).toBe(false);
    expect(parseShowDuplicates("show")).toBe(true);
    expect(parseShowDuplicates(["show"])).toBe(true);
    expect(duplicatesWhere(false)).toEqual({ duplicateOfId: null });
    expect(duplicatesWhere(true)).toEqual({});
  });
});

describe("parseIssueRef", () => {
  it("reads numbers, ids and issue URLs", () => {
    expect(parseIssueRef("#42")).toEqual({ number: 42 });
    expect(parseIssueRef("https://ziki.dev/issues/clx123abcdef456?comment=c1")).toEqual({ id: "clx123abcdef456" });
    // Links copied from the old host still parse (#424).
    expect(parseIssueRef("https://issues.zedu.chat/issues/clx123abcdef456?comment=c1")).toEqual({ id: "clx123abcdef456" });
    expect(parseIssueRef("https://issues.zedu.chat/bugs/clx123abcdef456?comment=c1")).toEqual({ id: "clx123abcdef456" });
    expect(parseIssueRef("cmgxyz0123456789abcdefghi")).toEqual({ id: "cmgxyz0123456789abcdefghi" });
  });
  it("rejects anything else", () => {
    expect(parseIssueRef("#0")).toBeNull();
    expect(parseIssueRef("login bug")).toBeNull();
  });
});
